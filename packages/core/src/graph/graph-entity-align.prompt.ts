import {
  clipNameCandidateSourceContext,
  type EntityAlignJudgeDecision,
  type EntityAlignJudgeInput,
  type EntityAlignJudgeOutput,
  type EntityAlignJudgeUncertain,
  type EntityAlignNameJudgeInput
} from './graph-entity-align.types'

const SUMMARY_PROMPT_MAX = 80

function clipSummary(text: string): string {
  const t = text.trim()
  if (t.length <= SUMMARY_PROMPT_MAX) return t
  return `${t.slice(0, SUMMARY_PROMPT_MAX)}…`
}

export function buildEntityAlignPrompt(input: EntityAlignJudgeInput): {
  system: string
  user: string
} {
  return {
    system:
      '你是关系图谱实体对齐器。只输出严格 JSON，不要 markdown，不要解释。只在确定是现实中的同一个实体时才合并。',
    user: `下面是本批新抽出的称呼，以及库里可能对应的已有节点。判断哪些是同一个人/地点/组织等。

## 规则
1. 只合并确定是同一实体的项；同名不同人、不同城市不要合并
2. incoming 可以并到 existing，也可以本批 incoming 互相合并
3. 合并后 existing 的 name 保持不变，incoming 的称呼会变成别名
4. 确定不是同一人：不要出现在 merges 里（视为新建，不进待合并列表）
5. 吃不准：写进 uncertain，仍视为新建，由用户决定是否合并。reason 用一句中文写清为什么吃不准

## incoming
${JSON.stringify(
  input.incoming.map((item) => ({
    ref: item.ref,
    type: item.nodeType,
    name: item.name,
    aliases: item.aliases,
    summary: clipSummary(item.summary),
    sourceContext: clipNameCandidateSourceContext(item.sourceContext) || undefined
  })),
  null,
  0
)}

## existing
${JSON.stringify(
  input.existing.map((item) => ({
    ref: item.ref,
    type: item.nodeType,
    name: item.name,
    aliases: item.aliases,
    summary: clipSummary(item.summary)
  })),
  null,
  0
)}

## 输出格式（严格 JSON）
{"merges":[{"incoming":"i1","existing":"e1"},{"incoming":"i2","same_as":"i1"}],"uncertain":[{"incoming":"i3","existing":"e2","reason":"出处不够，分不清是不是同一个人"}]}`
  }
}

export function buildNameCandidateJudgePrompt(input: EntityAlignNameJudgeInput): {
  system: string
  user: string
} {
  return {
    system:
      '你是关系图谱同名候选判定器。只输出严格 JSON，不要 markdown，不要解释。只能从给定候选里选一个 id，不能编造区分信息，不能编造新 id。不确定就输出 {"id":null}。',
    user: `下面是本篇抽到的称呼，以及库里已经登记的同名候选。判断这篇说的是哪一个实体。

## 规则
1. 只能从 candidates 里选一个 id
2. 不能发明新的区分信息，不能发明新的 id
3. 不确定、同名不同人分不清、候选都不像 → {"id":null}

## incoming
${JSON.stringify(
  {
    type: input.incoming.nodeType,
    name: input.incoming.name,
    aliases: input.incoming.aliases,
    summary: clipSummary(input.incoming.summary)
  },
  null,
  0
)}

## candidates
${JSON.stringify(
  input.candidates.map((item) => ({
    id: item.id,
    type: input.incoming.nodeType,
    name: item.name,
    discriminator: item.discriminator || '',
    aliases: item.aliases,
    summary: clipSummary(item.summary)
  })),
  null,
  0
)}

## sourceContext
${input.sourceContext?.trim() ? input.sourceContext.trim() : '（无）'}

## 输出格式（严格 JSON）
{"id":"<candidate-id 或 null>"}`
  }
}

function extractFirstJsonObject(text: string): string | null {
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
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
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

export function parseNameCandidateDecision(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const json = extractFirstJsonObject(text)
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as { id?: unknown; candidateId?: unknown }
    const raw = parsed.id !== undefined ? parsed.id : parsed.candidateId
    if (raw == null) return null
    if (typeof raw !== 'string') return null
    const id = raw.trim()
    if (!id || id === 'null') return null
    return id
  } catch {
    return null
  }
}

export function parseEntityAlignDecisions(
  text: string | null | undefined
): EntityAlignJudgeOutput | null {
  return parseEntityAlignJudgeOutput(text)
}

export function parseEntityAlignJudgeOutput(
  text: string | null | undefined
): EntityAlignJudgeOutput | null {
  if (!text?.trim()) return null
  const json = extractFirstJsonObject(text)
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as { merges?: unknown; uncertain?: unknown }
    const hasMerges = Array.isArray(parsed.merges)
    const hasUncertain = Array.isArray(parsed.uncertain)
    if (!hasMerges && !hasUncertain) return null
    const merges: EntityAlignJudgeDecision[] = []
    if (hasMerges) {
      for (const raw of parsed.merges as unknown[]) {
        if (!raw || typeof raw !== 'object') continue
        const row = raw as { incoming?: unknown; existing?: unknown; same_as?: unknown }
        const incomingRef = String(row.incoming || '').trim()
        if (!incomingRef) continue
        const existingRef = String(row.existing || '').trim()
        const sameAsIncomingRef = String(row.same_as || '').trim()
        merges.push({
          incomingRef,
          existingRef: existingRef || undefined,
          sameAsIncomingRef: sameAsIncomingRef || undefined
        })
      }
    }
    const uncertain: EntityAlignJudgeUncertain[] = []
    if (hasUncertain) {
      for (const raw of parsed.uncertain as unknown[]) {
        if (!raw || typeof raw !== 'object') continue
        const row = raw as {
          incoming?: unknown
          existing?: unknown
          reason?: unknown
          similarity?: unknown
        }
        const incomingRef = String(row.incoming || '').trim()
        const existingRef = String(row.existing || '').trim()
        if (!incomingRef || !existingRef) continue
        const reason = typeof row.reason === 'string' ? row.reason.trim() : ''
        const similarity =
          typeof row.similarity === 'number' && Number.isFinite(row.similarity)
            ? row.similarity
            : undefined
        uncertain.push({
          incomingRef,
          existingRef,
          reason: reason || undefined,
          similarity
        })
      }
    }
    return { merges, uncertain }
  } catch {
    return null
  }
}
