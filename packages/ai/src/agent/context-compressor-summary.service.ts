import { streamText } from 'ai'
import type { ModelMessage } from 'ai'
import { IAIProvider } from '../providers/provider.interface'
import {
  getDefaultCompressionSystemPrompt,
  adaptCompressionSystemPrompt,
  isAgentStreamAbortError,
  logger
} from '@baishou/shared'
import { buildSmallTaskReasoningOptions } from '../providers/reasoning'
import { runWithOpenAiThinkingInjectAsync } from '../providers/reasoning/openai-thinking-inject'
import { MessageWithParts } from './message.adapter'
import {
  extractMessageText,
  buildCompressionUserMessageContent,
  type SessionCompressionConfig
} from './context-compression.utils'
import { consumeCompressionModelStream } from './compression-stream.utils'
import {
  AGENT_STREAM_FIRST_OUTPUT_TIMEOUT_MS,
  isAgentFirstOutputTimeoutError,
  runWithFirstOutputTimeout
} from './agent-stream-timeout'
import { abortAgentStreamSession } from './stream-session-guard'
import {
  wrapLanguageModelWithMiddlewares,
  buildCachedSystemForStream
} from '../middleware/middleware-factory'

/** 压缩模型流式生成的结果；null 表示模型没有产出可用的摘要。 */
export type GeneratedCompressionSummary = {
  text: string
  reasoning?: string
  completionTokens: number
  thoughtDurationMs: number
  summaryDurationMs: number
}

/**
 * 调用压缩模型生成摘要文本。
 * 只负责模型调用与流式消费，不读写快照/标记，便于 ContextCompressorService 的自动与手动压缩共用。
 */
export async function generateCompressionSummaryText(
  provider: IAIProvider,
  modelId: string,
  sessionId: string,
  toCompress: MessageWithParts[],
  compressionConfig: SessionCompressionConfig,
  priorSummaryText: string | null,
  providerType: string,
  abortSignal?: AbortSignal,
  options?: { wrapMessageTime?: boolean; streamClaimGeneration?: number }
): Promise<GeneratedCompressionSummary | null> {
  const baseModel = provider.getLanguageModel(modelId, { sessionId })
  const model = wrapLanguageModelWithMiddlewares(baseModel, {
    providerType,
    modelId,
    sessionId
  })
  const wrapMessageTime = options?.wrapMessageTime !== false
  const rawSystem = compressionConfig.systemPrompt?.trim() || getDefaultCompressionSystemPrompt()
  const systemBase = adaptCompressionSystemPrompt(rawSystem, undefined, { wrapMessageTime })

  const userContent = buildCompressionUserMessageContent(toCompress, priorSummaryText, options)
  if (!userContent) return null

  const messages: ModelMessage[] = [{ role: 'user', content: userContent }]

  const builtReasoning = buildSmallTaskReasoningOptions({
    modelId,
    providerType,
    baseUrl: provider.config?.baseUrl
  })

  let streamed: Awaited<ReturnType<typeof consumeCompressionModelStream>>
  try {
    streamed = await runWithFirstOutputTimeout({
      timeoutMs: AGENT_STREAM_FIRST_OUTPUT_TIMEOUT_MS,
      abort: () => {
        if (options?.streamClaimGeneration !== undefined) {
          abortAgentStreamSession(sessionId, options.streamClaimGeneration)
        }
      },
      run: async (markFirstOutput) => {
        const streamResult = await runWithOpenAiThinkingInjectAsync(
          builtReasoning.openAiThinkingInject,
          async () =>
            streamText({
              model,
              system: buildCachedSystemForStream(systemBase, {
                providerType,
                modelId,
                sessionId
              }),
              allowSystemInMessages: true,
              messages,
              temperature: 0.1,
              abortSignal,
              experimental_telemetry: { isEnabled: false },
              ...(builtReasoning.providerOptions
                ? { providerOptions: builtReasoning.providerOptions as never }
                : {})
            })
        )
        return consumeCompressionModelStream(streamResult, sessionId, abortSignal, {
          onFirstOutput: markFirstOutput
        })
      }
    })
  } catch (streamErr: unknown) {
    const aborted = isAgentStreamAbortError(streamErr)
    if (!aborted && !isAgentFirstOutputTimeoutError(streamErr)) {
      const detail = streamErr instanceof Error ? streamErr.message : String(streamErr)
      logger.error(`[ContextCompressor] Session(${sessionId}) model stream failed: ${detail}`)
    }
    throw streamErr
  }

  if (!streamed.summaryText) {
    logger.error(
      `[ContextCompressor] Session(${sessionId}) empty summary (API may have returned an error).`
    )
    return null
  }
  const lastAssistant = [...toCompress].reverse().find((m) => m.role === 'assistant')
  const lastAssistantText = lastAssistant ? extractMessageText(lastAssistant).trim() : ''
  if (lastAssistantText.length > 40 && streamed.summaryText === lastAssistantText) {
    return null
  }

  return {
    text: streamed.summaryText,
    reasoning: streamed.reasoningText || undefined,
    completionTokens: streamed.completionTokens,
    thoughtDurationMs: streamed.thoughtDurationMs,
    summaryDurationMs: streamed.summaryDurationMs
  }
}

/** 重新压缩时优先更新已有触发用户消息上的 compaction 标记。 */
export function resolveRecompressMarkerMessageId(
  allMessages: MessageWithParts[],
  snapshotId: number,
  fallbackMessageId: string
): string {
  for (const msg of allMessages) {
    const part = msg.parts?.find((p) => p.type === 'compaction')
    const data = part?.data as { snapshotId?: number } | undefined
    if (data?.snapshotId === snapshotId) {
      return msg.id
    }
  }
  return fallbackMessageId
}
