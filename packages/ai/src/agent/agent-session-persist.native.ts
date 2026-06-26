import { StreamTextResult } from 'ai'
import { SessionRepository } from '@baishou/database'
import { logger, sanitizeAssistantGeneratedText } from '@baishou/shared'
import { IAIProvider } from '../providers/provider.interface'
import { ModelPricingService } from '../pricing/model-pricing.service'
import { mergeStreamUsageFromSdk, normalizeTokenUsageForBilling } from './token-usage.util'
import { StreamAccumulator } from './stream-accumulator'
import { resolveAssistantParentOrderIndex } from './agent-session-persist.utils'
// @ts-ignore
import { SnapshotRepository } from '@baishou/database'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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

  // 推送文本 Part
  if (accumulator.text) {
    partsToInsert.push({
      id: generateUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'text',
      data: { text: sanitizeAssistantGeneratedText(accumulator.text) }
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
      logger.warn('[Persist Result] Skip malformed tool-call snapshot:', tc)
      continue
    }
    const resultObj = accumulator.toolResults.find((tr) => tr.callId === tc.callId)
    partsToInsert.push({
      id: generateUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'tool',
      data: {
        callId: tc.callId,
        name: tc.name,
        arguments: tc.arguments,
        result: resultObj ? resultObj.result : undefined,
        status: resultObj ? 'completed' : 'failed'
      }
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
        (e as { [key: symbol]: unknown } | null)?.[Symbol.for('vercel.ai.error.AI_NoOutputGeneratedError')] ===
        true
      if (e instanceof Error && e.name === 'AbortError') {
        logger.info(
          '[AgentSessionService Debug] streamResult.usage read gracefully skipped (stream aborted by user).'
        )
      } else if (isNoOutputError) {
        logger.info(
          '[AgentSessionService Debug] streamResult.usage skipped (no model output generated).'
        )
      } else {
        logger.warn('[AgentSessionService Debug] Failed to read streamResult.usage:', e)
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
  if (partsToInsert.length > 0) {
    await sessionRepo.insertMessageWithParts(
      {
        id: assistantMsgId,
        sessionId,
        role: 'assistant',
        orderIndex: userOrderIndex + 1,
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
