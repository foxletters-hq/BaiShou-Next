import * as crypto from 'crypto'
import { logger } from '@baishou/shared'
import type { GlobalModelsConfig } from '@baishou/shared'
import type { SessionRepository } from '@baishou/database'
import { AssistantRepository } from '@baishou/database'
import type { SessionManagerService } from '@baishou/core-desktop'
import type { InsertPartInput } from '@baishou/database'
import { pathService } from '../ipc/vault.ipc'
import { settingsManager } from '../ipc/settings.ipc'

export const COMPRESSION_TEST_ROUND_COUNT = 15

/** 测试数据 token 规模：略高于伙伴 compressTokenThreshold，确保超过触发线 */
export function resolveCompressionTestTargetTokens(threshold: number): number {
  if (threshold <= 0) {
    return 15_000
  }
  return Math.max(threshold + 2_000, Math.ceil(threshold * 1.15))
}

export interface CompressionTestSessionResult {
  sessionId: string
  title: string
  roundCount: number
  messageCount: number
  estimatedContextTokens: number
  /** 注入时绑定的伙伴压缩阈值（0 表示未启用） */
  compressTokenThreshold: number
}

interface ToolSimSpec {
  name: string
  arguments: Record<string, unknown>
  resultChars: number
}

interface TurnSpec {
  user: string
  assistantIntro: string
  tools?: ToolSimSpec[]
  assistantTail?: string
}

const TURN_SPECS: TurnSpec[] = [
  {
    user: '我在做 BaiShou-Next 的对话压缩功能，请先帮我梳理一下滚动压缩的整体架构，以及快照表 compression_snapshots 各字段的含义。',
    assistantIntro:
      '滚动压缩的核心是 anchored summary：每次只压缩「上次快照之后、保留区之前」的新消息，并把旧摘要放进 `<previous-summary>` 让模型增量更新。'
  },
  {
    user: '帮我查一下最近日记里有没有写过 context compressor 或 compression snapshot 相关笔记。',
    assistantIntro: '我先检索你的日记索引，看看有没有相关记录。',
    tools: [
      {
        name: 'diary_search',
        arguments: { query: 'compression snapshot context compressor', limit: 8 },
        resultChars: 4200
      }
    ],
    assistantTail: '检索结果显示你曾在调试快照锚点与 tailStartMessageId 的对应关系。'
  },
  {
    user: 'splitMessagesForCompression 是怎么保留最近 N 轮用户对话的？请结合 keepTurns 和 preserveRecentTokens 解释。',
    assistantIntro:
      '算法从时间线末尾向前数 user 轮次，找到 retainFromIndex；若保留区 token 仍超出 preserveRecentTokens，会继续把起点往后推。'
  },
  {
    user: '搜索一下这个会话里之前有没有讨论过 resolveCompressionBatch。',
    assistantIntro: '我在当前 Agent 会话消息里搜索关键词。',
    tools: [
      {
        name: 'message_search',
        arguments: { query: 'resolveCompressionBatch', sessionScope: 'current' },
        resultChars: 3800
      }
    ]
  },
  {
    user: 'ContextWindowBuilder 注入摘要时，tailStartMessageId 缺失会怎么回退？',
    assistantIntro:
      '会回退到 coveredUpToMessageId 的下一条；若锚点消息被删，还会用 messageCount 跨度估算 cutoff。'
  },
  {
    user: '读一下 packages/ai/src/agent/context-compressor.service.ts 里 generateSummaryText 的实现要点。',
    assistantIntro: '该函数把 toCompress 转成 ModelMessage，末尾追加 anchored user prompt，temperature 设为 0.1。',
    tools: [
      {
        name: 'diary_read',
        arguments: { path: 'packages/ai/src/agent/context-compressor.service.ts' },
        resultChars: 5500
      }
    ]
  },
  {
    user: '自动压缩和手动重新压缩在 priorSnapshot 选择上有什么不同？',
    assistantIntro:
      '自动压缩用 latestSnapshot.summaryText 作锚；重新压缩用 previousSnapshot 作锚，并锁定 latestSnapshot 的消息范围原地更新。'
  },
  {
    user: '查一下同类 agent 项目对 preserve_recent_tokens 的通常取值。',
    assistantIntro: '我去检索外部资料与常见实现。',
    tools: [
      {
        name: 'web_search',
        arguments: { query: 'preserve_recent_tokens context compression agent' },
        resultChars: 4500
      }
    ]
  },
  {
    user: 'CompressionPruneService 剪枝工具输出的策略是什么？和 LLM 摘要有什么关系？',
    assistantIntro:
      'Prune 从后往前保留最近若干 user 轮内的 tool 输出 token，更早的大块 tool 文本替换成占位符；不走 LLM，可与摘要并行。'
  },
  {
    user: '如果 coveredUpToMessageId 落在 user 消息上，getMessagesAfterSnapshot 为什么要 trim 孤立 assistant 前缀？',
    assistantIntro:
      '避免快照截断在 user 上时，下一段开头残留无配对的 assistant/tool 前缀，导致摘要模型或主对话上下文不完整。'
  },
  {
    user: '用向量搜索看看项目记忆里有没有 compression trigger 阈值相关的说明。',
    assistantIntro: '尝试语义检索项目内相关片段。',
    tools: [
      {
        name: 'vector_search',
        arguments: { query: 'compression trigger threshold token window', topK: 6 },
        resultChars: 3600
      }
    ]
  },
  {
    user: 'estimateContextTokensForTrigger 为什么优先用最后一条 assistant 的 usage？',
    assistantIntro:
      '因为那最接近真实送入模型的上下文规模；没有 usage 时才回退到文本估算 + 摘要 token。'
  },
  {
    user: '分支会话 copyBranchCompressionSnapshots 需要怎样重锚消息 ID？',
    assistantIntro:
      '复制消息时维护 oldId→newId 映射，再按映射重写 coveredUpToMessageId 与 tailStartMessageId。'
  },
  {
    user: '现在几点？另外帮我确认今天是否适合继续压测长上下文。',
    assistantIntro: '先获取当前时间，再给你建议。',
    tools: [
      {
        name: 'current_time',
        arguments: {},
        resultChars: 120
      },
      {
        name: 'diary_list',
        arguments: { limit: 5 },
        resultChars: 2800
      }
    ],
    assistantTail: '时间已确认；从排期看你今天可以继续做压缩回归。'
  },
  {
    user: '今天先到这里，帮我用三句话总结一下我们刚才讨论的压缩架构要点。',
    assistantIntro:
      '可以概括为三点：一是 anchored summary 增量滚动；二是快照表记录 coveredUpTo 与 tailStart 锚点；三是保留最近若干轮原文再拼接摘要。'
  }
]

const PADDING_SENTENCES = [
  '实现上需要注意 tool call 与 tool result 不能在中途截断，否则 Vercel AI SDK 会拒绝上下文。',
  '压缩批次必须包含至少一条 user 文本，否则 ContextCompressor 会直接 skip。',
  '摘要禁止只复述最后一条 assistant 寒暄，测试用例里也校验了 VERBATIM_SUMMARY。',
  'tailStartMessageId 等于 coveredUpTo 的下一条，用于 ContextWindowBuilder 精确拼接保留区。',
  '会话锁 runCompressionWithSessionLock 避免并发压缩与主对话流式写入竞态。',
  '保留区默认按伙伴 compressKeepTurns 配置，常见值为 3 轮用户对话。',
  '模型窗口 unknown 时默认 128k，reserved 取窗口 20% 且夹在 8k–40k。',
  '手动 recompress 不会把快照点之后的新消息纳入，那是自动压缩的职责。',
  'generateSummaryText 在摘要与最后 assistant 长文本完全一致时会返回 null 防止偷懒复制。',
  'Prune 占位符为「工具输出已剪枝，详见对话摘要」，可显著降低 trigger 前的 tool token。'
]

function charsForTokens(tokens: number): number {
  return tokens * 3
}

function padToChars(seed: string, targetChars: number): string {
  if (targetChars <= 0) return ''
  let body = seed.trim()
  let i = 0
  while (body.length < targetChars) {
    body += `\n\n${PADDING_SENTENCES[i % PADDING_SENTENCES.length]}`
    body += `（测试填充 ${Math.floor(body.length / 3)} tokens 规模的长上下文压测文本。）`
    i++
  }
  return body.slice(0, targetChars)
}

function makeToolResult(tool: ToolSimSpec): string {
  const header = `[模拟工具结果: ${tool.name}]\n${JSON.stringify(tool.arguments, null, 2)}\n---\n`
  const filler = PADDING_SENTENCES.map((s, idx) => `${idx + 1}. ${s}`).join('\n')
  return padToChars(`${header}${filler}`, tool.resultChars)
}

function distributeCharBudget(totalChars: number): number[] {
  const base = Math.floor(totalChars / TURN_SPECS.length)
  const budgets = TURN_SPECS.map((spec, index) => {
    let budget = base
    for (const tool of spec.tools ?? []) {
      budget -= tool.resultChars
    }
    if (index === TURN_SPECS.length - 1) {
      budget += totalChars - base * TURN_SPECS.length
    }
    return Math.max(800, budget)
  })
  return budgets
}

function generateUUID(): string {
  return crypto.randomUUID()
}

function buildPartsForTurn(
  spec: TurnSpec,
  assistantBody: string,
  sessionId: string,
  messageId: string
): InsertPartInput[] {
  const parts: InsertPartInput[] = [
    {
      id: generateUUID(),
      messageId,
      sessionId,
      type: 'text',
      data: { text: assistantBody }
    }
  ]

  for (const tool of spec.tools ?? []) {
    parts.push({
      id: generateUUID(),
      messageId,
      sessionId,
      type: 'tool',
      data: {
        callId: generateUUID(),
        name: tool.name,
        arguments: tool.arguments,
        result: makeToolResult(tool),
        status: 'completed'
      }
    })
  }

  if (spec.assistantTail?.trim()) {
    parts.push({
      id: generateUUID(),
      messageId,
      sessionId,
      type: 'text',
      data: { text: spec.assistantTail.trim() }
    })
  }

  return parts
}

async function readAssistantCompressThreshold(
  sessionRepo: SessionRepository,
  assistantId?: string
): Promise<number> {
  if (!assistantId) return 0
  const astRepo = new AssistantRepository(sessionRepo.db)
  const ast = await astRepo.findById(assistantId)
  return ast?.compressTokenThreshold ?? 0
}

export async function insertCompressionTestSession(deps: {
  sessionManager: SessionManagerService
  sessionRepo: SessionRepository
  assistantId?: string
  providerId: string
  modelId: string
}): Promise<CompressionTestSessionResult> {
  const { sessionManager, sessionRepo, assistantId, providerId, modelId } = deps

  let vaultName = 'default'
  try {
    const activeVaultPath = await pathService.getActiveVaultPath()
    if (activeVaultPath) vaultName = activeVaultPath
  } catch {
    /* use default */
  }

  const sessionId = generateUUID()
  const title = `压缩测试 ${new Date().toLocaleString('zh-CN', { hour12: false })}`

  await sessionManager.upsertSession({
    id: sessionId,
    vaultName,
    providerId,
    modelId,
    assistantId,
    title
  })

  const compressTokenThreshold = await readAssistantCompressThreshold(sessionRepo, assistantId)
  const targetTokens = resolveCompressionTestTargetTokens(compressTokenThreshold)

  const totalContentChars = charsForTokens(targetTokens)
  const charBudgets = distributeCharBudget(totalContentChars)

  let orderIndex = 0
  let cumulativeInputTokens = 0

  for (let round = 0; round < TURN_SPECS.length; round++) {
    const spec = TURN_SPECS[round]!
    const isLastRound = round === TURN_SPECS.length - 1

    orderIndex++
    const userMsgId = generateUUID()
    await sessionRepo.insertMessageWithParts(
      {
        id: userMsgId,
        sessionId,
        role: 'user',
        orderIndex
      },
      [
        {
          id: generateUUID(),
          messageId: userMsgId,
          sessionId,
          type: 'text',
          data: { text: spec.user }
        }
      ]
    )

    orderIndex++
    const assistantMsgId = generateUUID()
    const assistantBody = padToChars(spec.assistantIntro, charBudgets[round]!)

    const inputTokens = isLastRound
      ? targetTokens - 800
      : Math.min(2400 + round * 180, 8000)
    const outputTokens = isLastRound ? 800 : 280 + round * 12
    cumulativeInputTokens += inputTokens
    cumulativeInputTokens += outputTokens

    await sessionRepo.insertMessageWithParts(
      {
        id: assistantMsgId,
        sessionId,
        role: 'assistant',
        orderIndex,
        inputTokens,
        outputTokens,
        costMicros: 0,
        providerId,
        modelId
      },
      buildPartsForTurn(spec, assistantBody, sessionId, assistantMsgId)
    )
  }

  await sessionRepo.updateTokenUsage(
    sessionId,
    cumulativeInputTokens,
    Math.floor(cumulativeInputTokens * 0.15),
    0
  )

  await sessionManager.flushSessionToDisk(sessionId)

  logger.info(
    `[Developer] Inserted compression test session ${sessionId} (${TURN_SPECS.length} rounds, ~${targetTokens} trigger tokens, assistant threshold=${compressTokenThreshold})`
  )

  return {
    sessionId,
    title,
    roundCount: TURN_SPECS.length,
    messageCount: orderIndex,
    estimatedContextTokens: targetTokens,
    compressTokenThreshold
  }
}

export async function resolveDefaultAgentIdentity(): Promise<{
  providerId: string
  modelId: string
  assistantId?: string
}> {
  const globalModels =
    (await settingsManager.get<GlobalModelsConfig>('global_models')) ?? ({} as GlobalModelsConfig)

  return {
    providerId: globalModels.globalDialogueProviderId || 'default',
    modelId: globalModels.globalDialogueModelId || 'default',
    assistantId: undefined
  }
}
