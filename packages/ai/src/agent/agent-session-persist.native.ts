import { StreamTextResult } from 'ai'
import { SessionRepository } from '@baishou/database'
import { logger, sanitizeAssistantGeneratedText } from '@baishou/shared'
import { IAIProvider } from '../providers/provider.interface'
import { ModelPricingService } from '../pricing/model-pricing.service'
import { mergeStreamUsageFromSdk, normalizeTokenUsageForBilling } from './token-usage.util'
import { StreamAccumulator } from './stream-accumulator'
import { resolveAssistantParentOrderIndex } from './agent-session-persist.utils'
import { sanitizeToolPayloadForStorage } from './session-tool-payload-sanitizer'
// @ts-ignore
import { SnapshotRepository } from '@baishou/database'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function resolveAssistantTextForStorage(accumulator: StreamAccumulator): string {
  if (typeof accumulator.sanitizedText === 'string') {
    return accumulator.sanitizedText
  }
  return sanitizeAssistantGeneratedText(accumulator.text)
}

export interface PersistResultParams {
  sessionId: string
  rawUserText: string
  streamResult: StreamTextResult<any, any>
  accumulator: StreamAccumulator
  sessionRepo: SessionRepository
  snapshotRepo: SnapshotRepository
  provider: IAIProvider
  modelId: string
  skipUserMessageRecording?: boolean
  userMessageId?: string
  streamError: any
  dbHistory?: any[]
  systemPrompt?: string
  namingModelConfigured?: boolean
  namingProvider?: IAIProvider
  namingModelId?: string
  /** 用户配置，用于查找 emoji_send 工具对应的表情包文件 */
  userConfig?: Record<string, any>
}

/**
 * 模糊匹配 emoji：支持 ID（含/不含扩展名）、名称、子串匹配
 */
function findEmojiById(
  query: string,
  emojis: Array<{ id: string; name: string; relativePath: string }>
): { id: string; name: string; relativePath: string } | undefined {
  const normalizedQuery = query.trim().toLowerCase()

  // 1. Exact id match
  const exactMatch = emojis.find((e) => e.id === normalizedQuery || e.id.toLowerCase() === normalizedQuery)
  if (exactMatch) return exactMatch

  // 2. Id without extension match
  const idNoExtMatch = emojis.find((e) => e.id.replace(/\.[^.]+$/, '').toLowerCase() === normalizedQuery)
  if (idNoExtMatch) return idNoExtMatch

  // 3. Name match (case-insensitive, underscore/space normalized)
  const normalizeName = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ').trim()
  const normalizedNameQuery = normalizeName(normalizedQuery)
  const nameMatch = emojis.find((e) => normalizeName(e.name) === normalizedNameQuery)
  if (nameMatch) return nameMatch

  // 4. Id without extension contains query
  const idContainsMatch = emojis.find((e) =>
    e.id.replace(/\.[^.]+$/, '').toLowerCase().includes(normalizedQuery)
  )
  if (idContainsMatch) return idContainsMatch

  // 5. Name contains query
  const nameContainsMatch = emojis.find((e) =>
    normalizeName(e.name).includes(normalizedNameQuery)
  )
  if (nameContainsMatch) return nameContainsMatch

  return undefined
}

/**
 * 从 emoji_send 工具调用参数中解析出 emoji_id。
 */
function parseEmojiIdFromArgs(args: unknown): string | null {
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args)
      if (parsed?.emoji_id && typeof parsed.emoji_id === 'string') return parsed.emoji_id
    } catch {
      if (args.length > 0) return args
    }
  } else if (args && typeof args === 'object') {
    const obj = args as Record<string, unknown>
    if (obj.emoji_id && typeof obj.emoji_id === 'string') return obj.emoji_id
  }
  return null
}

/**
 * 将流结果落盘到数据库。
 * 从 AgentSessionService 中拆出，职责更清晰。
 */
export async function persistResult(params: PersistResultParams): Promise<{
  assistantMessageId?: string
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
  costMicros: number
}> {
  const {
    sessionId,
    rawUserText,
    streamResult,
    accumulator,
    sessionRepo,
    snapshotRepo: _snapshotRepo,
    provider,
    modelId,
    skipUserMessageRecording,
    userMessageId,
    streamError
  } = params

  const userOrderIndex = await resolveAssistantParentOrderIndex(sessionRepo, sessionId, {
    skipUserMessageRecording,
    userMessageId
  })

  // ======== 构建 assistant 消息 Parts ========
  const assistantMsgId = generateUUID()
  const partsToInsert: any[] = []

  // 收集需要独立消息的 emoji 图片附件（每个 emoji 一条独立消息）
  const emojiExtraMessages: Array<{
    messageId: string
    orderIndex: number
    parts: any[]
  }> = []
  let emojiMessageIndex = 0

  // 推送文本 Part
  const assistantText = resolveAssistantTextForStorage(accumulator)
  if (assistantText) {
    partsToInsert.push({
      id: generateUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'text',
      data: { text: assistantText }
    })
  }

  // 推送推理 Part (如果有)
  if (accumulator.reasoning) {
    partsToInsert.push({
      id: generateUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'text',
      data: { text: accumulator.reasoning, isReasoning: true }
    })
  }

  // 推送工具 Call & Result Part
  for (const tc of accumulator.toolCalls) {
    if (!tc?.callId || !tc?.name) {
      logger.warn('[Persist Result] Skip malformed tool-call snapshot:', JSON.stringify(tc))
      continue
    }
    const resultObj = accumulator.toolResults.find((tr) => tr.callId === tc.callId)

    // 对 emoji_send 工具调用：为每个表情包创建一条独立的 assistant 消息（只包含图片）
    if (tc.name === 'emoji_send') {
      const emojiId = parseEmojiIdFromArgs(tc.arguments)
      if (emojiId) {
        const emojiConfig = (params as any).userConfig?.['emojiConfig'] as
          | { emojis?: Array<{ id: string; name: string; relativePath: string }> }
          | undefined
        const emojis = emojiConfig?.emojis
        if (emojis && emojis.length > 0) {
          const emoji = findEmojiById(emojiId, emojis)
          if (emoji) {
            const fileName = emoji.relativePath.split('/').pop() || 'emoji'
            const emojiMsgId = generateUUID()
            logger.info(`[Persist Result] Creating standalone emoji message: ${emoji.relativePath} (${emoji.name})`)
            emojiExtraMessages.push({
              messageId: emojiMsgId,
              // emoji 消息排在文本消息之前，这样表情包先显示，文字回复后显示
              orderIndex: userOrderIndex + 1 + emojiMessageIndex,
              parts: [{
                id: generateUUID(),
                messageId: emojiMsgId,
                sessionId,
                type: 'image',
                data: {
                  type: 'image',
                  filePath: emoji.relativePath,
                  url: `local:///${emoji.relativePath.replace(/\\/g, '/')}`,
                  isImage: true,
                  fileName,
                  name: emoji.name || fileName
                }
              }]
            })
            emojiMessageIndex++
          } else {
            logger.warn(`[Persist Result] Emoji not found for id: ${emojiId}`)
          }
        }
      }
    }

    // emoji_send 工具调用不存入数据库（表情包已作为独立图片消息）
    if (tc.name === 'emoji_send') {
      continue
    }

    const toolData = sanitizeToolPayloadForStorage({
      callId: tc.callId,
      name: tc.name,
      arguments: tc.arguments,
      result: resultObj ? resultObj.result : undefined,
      status: resultObj ? 'completed' : 'failed'
    })
    partsToInsert.push({
      id: generateUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'tool',
      data: toolData
    })
  }

  // 从 Vercel AI SDK 获取最终 usage
  let streamUsage = mergeStreamUsageFromSdk(accumulator.usage, null)
  let finalUsage = {
    inputTokens: streamUsage.inputTokens,
    outputTokens: streamUsage.outputTokens
  }
  let costMicros = 0

  if (!streamError) {
    try {
      const u = await streamResult.usage
      logger.info('[AgentSessionService Debug] streamResult.usage resolved to:', JSON.stringify(u))
      if (u) {
        streamUsage = mergeStreamUsageFromSdk(accumulator.usage, u as Record<string, unknown>)
        finalUsage = {
          inputTokens: streamUsage.inputTokens,
          outputTokens: streamUsage.outputTokens
        }
      }
    } catch (e: unknown) {
      const isNoOutputError =
        (e as { [key: symbol]: unknown } | null)?.[
          Symbol.for('vercel.ai.error.AI_NoOutputGeneratedError')
        ] === true
      if (e instanceof Error && e.name === 'AbortError') {
        logger.info(
          '[AgentSessionService Debug] streamResult.usage read gracefully skipped (stream aborted by user).'
        )
      } else if (isNoOutputError) {
        logger.info(
          '[AgentSessionService Debug] streamResult.usage skipped (no model output generated).'
        )
      } else {
        logger.warn('[AgentSessionService Debug] Failed to read streamResult.usage:', e as Error)
      }
    }

    // 极端情况兜底：本地量化预估
    if (finalUsage.inputTokens === 0 && finalUsage.outputTokens === 0) {
      try {
        if (accumulator.text.length > 0) {
          const { get_encoding } = await import('tiktoken')
          const enc = get_encoding('cl100k_base')
          let estimatedInput = enc.encode(rawUserText).length
          if (params.systemPrompt) {
            estimatedInput += enc.encode(params.systemPrompt).length
          }
          if (params.dbHistory && params.dbHistory.length > 0) {
            const { extractMessageText } = await import('./context-compression.utils')
            for (const msg of params.dbHistory) {
              const text = extractMessageText(msg)
              if (text) {
                estimatedInput += enc.encode(text).length
              }
            }
          }
          finalUsage.inputTokens = estimatedInput
          finalUsage.outputTokens = enc.encode(accumulator.text + accumulator.reasoning).length
          enc.free()
          logger.info(
            `[AgentSessionService] 提示: 接口未返回 Token，已启用本地预估策略! 预估输入: ${finalUsage.inputTokens}`
          )
        }
      } catch (e: any) {
        logger.warn('Fallback tiktoken estimation failed', e)
      }
    }

    // 累加计算 tokens 及账单微美分成本
    const providerId = provider?.config?.id ?? 'unknown'
    costMicros = await ModelPricingService.getInstance().calculateCostMicros(
      providerId,
      modelId,
      normalizeTokenUsageForBilling(streamUsage)
    )

    logger.info('\n================== 计费日志 ==================')
    logger.info(`模型: ${modelId} (${providerId})`)
    logger.info(
      `Tokens消耗: 输入 ${finalUsage.inputTokens} | 输出 ${finalUsage.outputTokens} | 缓存读 ${streamUsage.cacheReadInputTokens} | 缓存写 ${streamUsage.cacheWriteInputTokens}`
    )
    logger.info(
      `本次费用(Micros微美分): ${costMicros} (约合 $${(costMicros / 1000000).toFixed(6)})`
    )
    if (costMicros === 0) {
      logger.info(`提示: 计算费用为 0。可能模型是免费的，或未能从 models.dev 拉取到该模型价格。`)
    }
    logger.info('==============================================\n')
  } else {
    logger.warn(
      '[AgentSessionService] 流式过程发生错误，使用 Accumulator 中的有限数据落盘。错误:',
      streamError
    )
  }

  // 开始事务存放! — 即使流式出错，也将已累积的回复内容落盘，防止消息丢失

  // 1. 先插入 emoji 独立消息（表情包图片先于文字回复显示）
  for (const emojiMsg of emojiExtraMessages) {
    await sessionRepo.insertMessageWithParts(
      {
        id: emojiMsg.messageId,
        sessionId,
        role: 'assistant',
        orderIndex: emojiMsg.orderIndex,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
        costMicros: 0,
        providerId: provider.config.id,
        modelId: modelId
      },
      emojiMsg.parts
    )
  }

  // 2. 插入主文本消息（orderIndex 在所有 emoji 消息之后）
  const mainOrderIndex = userOrderIndex + 1 + emojiExtraMessages.length
  if (partsToInsert.length > 0) {
    await sessionRepo.insertMessageWithParts(
      {
        id: assistantMsgId,
        sessionId,
        role: 'assistant',
        orderIndex: mainOrderIndex,
        inputTokens: finalUsage.inputTokens,
        outputTokens: finalUsage.outputTokens,
        cacheReadInputTokens: streamUsage.cacheReadInputTokens,
        cacheWriteInputTokens: streamUsage.cacheWriteInputTokens,
        costMicros: costMicros,
        providerId: provider?.config?.id ?? 'unknown',
        modelId: modelId
      },
      partsToInsert
    )
  }

  await sessionRepo.updateTokenUsage(
    sessionId,
    finalUsage.inputTokens,
    finalUsage.outputTokens,
    costMicros,
    streamUsage.cacheReadInputTokens,
    streamUsage.cacheWriteInputTokens
  )

  // ==========================================
  // 触发闲置后台服务 (仅在无流错误时执行)
  // ==========================================
  if (!streamError) {
    void (async () => {
      await new Promise((r) => setTimeout(r, 500))
      if (userOrderIndex <= 2) {
        const { TitleGeneratorService } = await import('./title-generator.service')
        await TitleGeneratorService.maybeUpdateSessionTitle({
          sessionRepo,
          sessionId,
          userText: rawUserText,
          namingModelConfigured: params.namingModelConfigured,
          namingProvider: params.namingProvider,
          namingModelId: params.namingModelId
        })
      }
    })()
  }

  return {
    assistantMessageId: partsToInsert.length > 0 ? assistantMsgId : undefined,
    inputTokens: finalUsage.inputTokens,
    outputTokens: finalUsage.outputTokens,
    cacheReadInputTokens: streamUsage.cacheReadInputTokens,
    cacheWriteInputTokens: streamUsage.cacheWriteInputTokens,
    costMicros: costMicros
  }
}
