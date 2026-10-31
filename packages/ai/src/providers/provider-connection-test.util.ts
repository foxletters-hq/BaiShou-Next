import { generateText, streamText, type LanguageModel } from 'ai'
import { extractApiErrorMessage, isBenignConnectionTestLimitError } from './provider-api-error.util'
import { buildSmallTaskReasoningOptions } from './reasoning'
import { runWithOpenAiThinkingInjectAsync } from './reasoning/openai-thinking-inject'

/** 连接测试共用输出上限：过小会导致推理模型 thinking 触顶误报失败 */
export const CONNECTION_TEST_MAX_OUTPUT_TOKENS = 16

export const CONNECTION_TEST_TIMEOUT_MS = 15_000

export const CONNECTION_TEST_PROMPT = 'test'

export type ProbeProviderConnectionParams = {
  model: LanguageModel
  modelId?: string
  providerType?: string
  baseUrl?: string
  /**
   * 走流式探活（与真实聊天一致）。
   * 部分 React Native fetch 实现无法可靠读取非流式 JSON 响应，流式可避开该路径。
   */
  streaming?: boolean
}

/**
 * 各 Provider 共用的连通性探测。
 * 思考强度走小任务最弱档；触顶截断视为鉴权与网络已通。
 */
export async function probeProviderConnection(
  params: ProbeProviderConnectionParams
): Promise<void> {
  const abortController = new AbortController()
  const timeoutId = setTimeout(
    () => abortController.abort('Connection timeout'),
    CONNECTION_TEST_TIMEOUT_MS
  )

  try {
    const modelId = params.modelId?.trim()
    const built = modelId
      ? buildSmallTaskReasoningOptions({
          modelId,
          providerType: params.providerType,
          baseUrl: params.baseUrl
        })
      : undefined

    await runWithOpenAiThinkingInjectAsync(built?.openAiThinkingInject, async () => {
      const options = {
        model: params.model,
        prompt: CONNECTION_TEST_PROMPT,
        maxOutputTokens: CONNECTION_TEST_MAX_OUTPUT_TOKENS,
        abortSignal: abortController.signal,
        experimental_telemetry: { isEnabled: false },
        ...(built?.providerOptions ? { providerOptions: built.providerOptions as never } : {})
      }

      if (params.streaming) {
        const streamResult = streamText({
          ...options,
          onError: () => {}
        })
        for await (const part of streamResult.fullStream) {
          // streamText 不会在 API 错误时 reject，而是把错误作为流事件发出
          if (part.type === 'error') throw part.error
        }
        return
      }

      await generateText(options)
    })
  } catch (e: unknown) {
    const detail = extractApiErrorMessage(e)
    if (isBenignConnectionTestLimitError(detail)) {
      return
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

export function wrapConnectionTestError(providerName: string, error: unknown): Error {
  const detail = extractApiErrorMessage(error)
  console.error(`Test connection error for ${providerName}:`, error)
  return new Error(`Connection test failed: ${detail}`)
}
