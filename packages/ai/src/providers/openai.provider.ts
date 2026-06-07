import { createOpenAI } from '@ai-sdk/openai'
import { LanguageModel, EmbeddingModel, generateText } from 'ai'
import {
  AiProviderModel,
  isChatModelForConnectionTest,
  resolveProviderBaseUrl
} from '@baishou/shared'
import { IAIProvider } from './provider.interface'
import { getRotatedApiKey } from './provider.utils'
import {
  assertAsciiApiKey,
  createSanitizedFetch,
  sanitizeApiKeyForHttp,
  sanitizeRequestHeaders,
  sanitizeRequestInit
} from './fetch-header.util'
import { extractApiErrorMessage, formatModelNotAvailableMessage } from './provider-api-error.util'

/**
 * DeepSeek thinking 模式的请求方向拦截器：
 *
 * 将 assistant 消息中的 <think> 标签提取为独立的 reasoning_content 字段，
 * 满足 DeepSeek API 多轮对话中必须回传推理内容的要求。
 *
 * 响应方向的 reasoning_content 处理由 @ai-sdk/openai patch 原生支持，
 * 不再在此处对 SSE 流进行二次拦截（避免移动端 ReadableStream 兼容问题）。
 */
function createDeepSeekFetchInterceptor(
  baseURL?: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
) {
  const isDeepSeek = baseURL?.includes('deepseek')

  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const safeInit = sanitizeRequestInit(init)

    if (!isDeepSeek) {
      return fetchImpl(url, safeInit)
    }

    const urlStr = typeof url === 'string' ? url : url.toString()
    if (!urlStr.includes('/chat/completions')) {
      return fetchImpl(url, safeInit)
    }

    // 请求方向：提取 <think> → reasoning_content
    if (safeInit?.body && typeof safeInit.body === 'string') {
      try {
        const body = JSON.parse(safeInit.body)
        if (body.messages && Array.isArray(body.messages)) {
          for (const msg of body.messages) {
            if (msg.role !== 'assistant' || typeof msg.content !== 'string' || !msg.content) {
              continue
            }
            const thinkMatch = msg.content.match(/<think>\s*([\s\S]*?)\s*<\/think>/)
            if (thinkMatch) {
              const reasoningContent = thinkMatch[1].trim()
              msg.content = msg.content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim()
              msg.reasoning_content = reasoningContent
            }
          }
          safeInit.body = JSON.stringify(body)
        }
      } catch {
        // 解析失败则不干预
      }
    }

    return fetchImpl(url, safeInit)
      .then((response: Response) => {
        const hasBody = response.body != null
        const hasPipeThrough = hasBody && typeof (response.body as any).pipeThrough === 'function'
        console.log(
          '[FetchDebug] DeepSeek response: status=' + response.status +
          ' hasBody=' + hasBody +
          ' hasPipeThrough=' + hasPipeThrough +
          ' contentType=' + (response.headers.get('content-type') || 'N/A') +
          ' TDS=' + typeof (globalThis as any).TextDecoderStream
        )
        return response
      })
  }
}

/**
 * 通用的兼容 OpenAI 标准 API 格式的 Provider
 * 根据传入配置动态替换 BaseUrl 与 ApiKey
 */
export class OpenAIAdaptedProvider implements IAIProvider {
  public config: AiProviderModel
  constructor(config: AiProviderModel) {
    this.config = config
  }

  private resolvedBaseUrl(): string {
    return resolveProviderBaseUrl(this.config.id, this.config.type, this.config.baseUrl)
  }

  private _getSdk() {
    const rotatedKey = sanitizeApiKeyForHttp(getRotatedApiKey(this.config) || this.config.apiKey)
    const baseURL = this.resolvedBaseUrl() || undefined
    const sanitizedFetch = createSanitizedFetch()
    return createOpenAI({
      apiKey: rotatedKey,
      baseURL,
      fetch: createDeepSeekFetchInterceptor(baseURL, sanitizedFetch)
    })
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'gpt-4o'
    // Use .chat() to ensure we hit /v1/chat/completions instead of the new Responses API (/v1/responses)
    return this._getSdk().chat(targetModel) as unknown as LanguageModel
  }

  getEmbeddingModel(modelId?: string): EmbeddingModel {
    const targetModel = modelId || 'text-embedding-3-small'
    return this._getSdk().textEmbeddingModel(targetModel) as unknown as EmbeddingModel
  }

  async fetchAvailableModels(): Promise<string[]> {
    // OpenAI 原生的模型拉取端点。
    // 这里因为 AI SDK 屏蔽了该接口，我们可以使用基础的 fetch 调用
    const apiKey = sanitizeApiKeyForHttp(getRotatedApiKey(this.config) || this.config.apiKey)
    if (!apiKey && this.config.type !== 'ollama' && this.config.type !== 'lmstudio') {
      return []
    }

    const base = this.resolvedBaseUrl()
    const endpoint = base ? base.replace(/\/$/, '') + '/models' : 'https://api.openai.com/v1/models'

    try {
      const response = await createSanitizedFetch()(endpoint, {
        headers: sanitizeRequestHeaders({
          Authorization: `Bearer ${apiKey}`
        })
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      if (data && data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id)
      }
      throw new Error(`Invalid response format from API. Expected data array.`)
    } catch (e: any) {
      console.error(`Fetch models error for ${this.config.name}:`, e)
      throw new Error(e.message || 'Unknown network error')
    }
  }

  private filterChatModels(modelIds: string[]): string[] {
    return modelIds.filter((id) => isChatModelForConnectionTest(id))
  }

  private async resolveTestModelId(testModelId?: string): Promise<string> {
    const selected = testModelId?.trim()
    if (!selected) {
      throw new Error('No chat model selected for connection test.')
    }

    if (!isChatModelForConnectionTest(selected)) {
      throw new Error(
        `Model "${selected}" is not a chat model (embedding/rerank/TTS cannot be used for connection test). Pick a dialogue model in the test dialog.`
      )
    }

    let liveChatModels: string[] = []
    try {
      liveChatModels = this.filterChatModels(await this.fetchAvailableModels())
    } catch (e) {
      console.warn(`[OpenAIAdaptedProvider] Could not list models for ${this.config.id}:`, e)
    }

    if (liveChatModels.length > 0 && !liveChatModels.includes(selected)) {
      throw new Error(formatModelNotAvailableMessage(this.config.name, selected, liveChatModels))
    }

    return selected
  }

  async testConnection(testModelId?: string): Promise<void> {
    assertAsciiApiKey(getRotatedApiKey(this.config) || this.config.apiKey)

    const modelToTest = await this.resolveTestModelId(testModelId)

    try {
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort('Connection timeout'), 15000)

      await generateText({
        model: this.getLanguageModel(modelToTest),
        prompt: 'test',
        maxOutputTokens: 1,
        abortSignal: abortController.signal
      })

      clearTimeout(timeoutId)
    } catch (e: unknown) {
      console.error(`Test connection error for ${this.config.name}:`, e)
      const detail = extractApiErrorMessage(e)
      const isModelError = /model does not exist|model not found|invalid model/i.test(detail)
      if (isModelError) {
        let suggestions: string[] = []
        try {
          suggestions = this.filterChatModels(await this.fetchAvailableModels())
        } catch {
          // ignore
        }
        throw new Error(
          formatModelNotAvailableMessage(this.config.name, modelToTest, suggestions) +
            (detail ? ` (${detail})` : '')
        )
      }
      throw new Error(`Connection test failed: ${detail}`)
    }
  }
}
