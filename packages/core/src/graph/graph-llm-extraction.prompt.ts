import { streamText } from 'ai'
import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES } from '@baishou/database/shared'
import {
  buildDefaultReasoningOptions,
  runWithOpenAiThinkingInjectAsync,
  wrapLanguageModelWithMiddlewares
} from '@baishou/ai'
import { AI_FIRST_OUTPUT_TIMEOUT_MS, normalizeReasoningEffortSetting } from '@baishou/shared'
import type {
  ExtractionCostEstimate,
  GraphExtractLlmDeps,
  GraphExtractLlmFn
} from './graph-llm-extraction.types'
import {
  resolveGraphExtractLlmText,
  throwIfGraphExtractAborted
} from './graph-llm-extraction.stream'

const NODE_TYPE_SET = new Set<string>(GRAPH_NODE_TYPES)
const EDGE_TYPE_SET = new Set<string>(GRAPH_EDGE_TYPES)

/** Floor tokens/entry when char length unknown. */
const ESTIMATE_TOKENS_FLOOR = 600
/** Upper-bound multiplier so UI prefers overestimate. */
const ESTIMATE_OVERESTIMATE = 1.25
const ESTIMATE_SECONDS_PER_ENTRY_LOW = 2
const ESTIMATE_SECONDS_PER_ENTRY_HIGH = 4

export function clampNodeType(raw: string): string {
  const t = raw.trim().toLowerCase()
  return NODE_TYPE_SET.has(t) ? t : 'topic'
}

export function clampEdgeType(raw: string): string {
  const t = raw.trim().toLowerCase()
  return EDGE_TYPE_SET.has(t) ? t : 'relates_to'
}

/** Test helper: clamp enums without LLM */
export function clampGraphExtractEnumsForTest(input: { nodeType: string; edgeType: string }): {
  nodeType: string
  edgeType: string
} {
  return {
    nodeType: clampNodeType(input.nodeType),
    edgeType: clampEdgeType(input.edgeType)
  }
}

/** Per-diary token estimate from character count (prefer overestimate). */
export function estimateTokensForDiaryChars(chars: number): number {
  const n = Math.max(0, Math.floor(chars))
  return Math.max(ESTIMATE_TOKENS_FLOOR, Math.ceil(n / 2))
}

/**
 * Estimate LLM time for extracting diaries.
 * Prefer passing `charCounts` (per pending file); without them falls back to floor × entryCount.
 */
export function estimateExtractionCost(
  entryCount: number,
  opts?: { charCounts?: number[] }
): ExtractionCostEstimate {
  const n = Math.max(0, Math.floor(entryCount))
  const counts = opts?.charCounts
  let rawTokens = 0
  if (counts && counts.length > 0) {
    const limited = counts.slice(0, n || counts.length)
    for (const c of limited) rawTokens += estimateTokensForDiaryChars(c)
    if (n > limited.length) {
      rawTokens += (n - limited.length) * ESTIMATE_TOKENS_FLOOR
    }
  } else {
    rawTokens = n * ESTIMATE_TOKENS_FLOOR
  }
  const estimatedTokens = Math.ceil(rawTokens * ESTIMATE_OVERESTIMATE)
  return {
    entryCount: n,
    estimatedTokens,
    estimatedMinutesLow:
      n === 0 ? 0 : Math.max(1, Math.ceil((n * ESTIMATE_SECONDS_PER_ENTRY_LOW) / 60)),
    estimatedMinutesHigh:
      n === 0 ? 0 : Math.max(1, Math.ceil((n * ESTIMATE_SECONDS_PER_ENTRY_HIGH) / 60))
  }
}

/** Extract the first balanced JSON object from LLM text (handles markdown fences). */
export function extractFirstJsonObject(text: string): string | null {
  const stripped = text
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = stripped.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i]!
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return stripped.slice(start, i + 1)
    }
  }
  return null
}

export interface LlmEntity {
  name: string
  type: string
  aliases?: string[]
  summary?: string
  confidence?: number
}

export interface LlmEdge {
  from: string
  to: string
  type: string
  excerpt?: string
  confidence?: number
}

export interface LlmExtractPayload {
  entities: LlmEntity[]
  edges: LlmEdge[]
}

export function parseJsonObject(raw?: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function parseExtractJson(text: string): LlmExtractPayload | null {
  const json = extractFirstJsonObject(text)
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as Partial<LlmExtractPayload>
    return {
      entities: Array.isArray(parsed.entities) ? (parsed.entities as LlmEntity[]) : [],
      edges: Array.isArray(parsed.edges) ? (parsed.edges as LlmEdge[]) : []
    }
  } catch {
    return null
  }
}

export function buildExtractPrompt(
  diaryText: string,
  dateStr: string | null,
  selfName: string
): {
  system: string
  user: string
} {
  const nodeTypes = GRAPH_NODE_TYPES.join(', ')
  const edgeTypes = GRAPH_EDGE_TYPES.join(', ')
  const author = selfName.trim()
  return {
    system: '你是日记关系图谱抽取器。只输出严格 JSON，不要 markdown 代码块，不要额外解释。',
    user: `从以下日记中抽取实体与关系。

## 约束
1. node type 只能是: ${nodeTypes}
2. edge type 只能是: ${edgeTypes}
3. 不要编造日记未出现的事实；不确定的实体/边给较低 confidence（0-100）
4. 实体 name 用日记中的称呼；可填 aliases
5. edges.from / edges.to 使用实体 name（或 entry 锚点名）
6. 每篇日记都有一个结构性锚点 entry（name 用日期或「日记」），实体应尽量连到 entry（mentions / participates_in / evokes 等）
7. 日记中的第一人称「我」以及作者本人，统一使用自称「${author}」作为 person 实体名；禁止使用「日记的主人」「作者」「用户」等占位称呼

## 日记日期
${dateStr || '未知'}

## 日记正文
${diaryText.slice(0, 12000)}

## 输出格式（严格 JSON）
{"entities":[{"name":"","type":"person","aliases":[],"summary":"","confidence":80}],"edges":[{"from":"","to":"","type":"mentions","excerpt":"","confidence":80}]}`
  }
}

export function createDefaultGraphExtractLlm(deps: GraphExtractLlmDeps): GraphExtractLlmFn {
  return async ({ system, user, signal, onDelta, onReasoning }) => {
    throwIfGraphExtractAborted(signal)
    const baseModel = deps.provider.getLanguageModel(deps.modelId)
    const model = wrapLanguageModelWithMiddlewares(baseModel, {
      providerType: deps.provider.config?.type || 'openai',
      providerId: deps.provider.config?.id,
      modelId: deps.modelId
    })
    const builtReasoning = buildDefaultReasoningOptions({
      modelId: deps.modelId,
      providerType: deps.provider.config?.type || 'openai',
      baseUrl: deps.provider.config?.baseUrl,
      effort: normalizeReasoningEffortSetting(deps.reasoningEffort)
    })
    return runWithOpenAiThinkingInjectAsync(builtReasoning.openAiThinkingInject, async () => {
      const abortController = new AbortController()
      const onUserAbort = () => abortController.abort()
      signal?.addEventListener('abort', onUserAbort)
      let firstOutputSeen = false
      let timedOut = false
      const timeoutId = setTimeout(() => {
        if (firstOutputSeen) return
        timedOut = true
        abortController.abort()
      }, AI_FIRST_OUTPUT_TIMEOUT_MS)
      const markFirstOutput = () => {
        if (firstOutputSeen) return
        firstOutputSeen = true
        clearTimeout(timeoutId)
      }
      const streamResult = streamText({
        model,
        system,
        messages: [{ role: 'user', content: user }],
        temperature: 0.1,
        abortSignal: abortController.signal,
        ...(builtReasoning.providerOptions
          ? { providerOptions: builtReasoning.providerOptions as never }
          : {})
      })
      const textPromise = Promise.resolve(streamResult.text)
      void textPromise.catch(() => undefined)
      void Promise.resolve(streamResult.usage).catch(() => undefined)
      void Promise.resolve(streamResult.response).catch(() => undefined)
      try {
        const text = await resolveGraphExtractLlmText({
          fullStream: streamResult.fullStream,
          textStream: streamResult.textStream,
          textPromise,
          signal: abortController.signal,
          onDelta: (chars) => {
            markFirstOutput()
            onDelta?.(chars)
          },
          onReasoning: (chars) => {
            markFirstOutput()
            onReasoning?.(chars)
          }
        })
        if (timedOut) {
          throw new Error(
            `AI generation timeout: timed out after ${AI_FIRST_OUTPUT_TIMEOUT_MS / 1000} seconds waiting for first output.`
          )
        }
        return text?.trim() || null
      } catch (error) {
        if (timedOut) {
          throw new Error(
            `AI generation timeout: timed out after ${AI_FIRST_OUTPUT_TIMEOUT_MS / 1000} seconds waiting for first output.`
          )
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', onUserAbort)
      }
    })
  }
}
