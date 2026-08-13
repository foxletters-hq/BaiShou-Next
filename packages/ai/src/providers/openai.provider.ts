import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { LanguageModel, EmbeddingModel } from 'ai'
import {
  AiProviderModel,
  isChatModelForConnectionTest,
  isOpenAiStyleReasoningModel,
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
import {
  extractApiErrorMessage,
  formatModelNotAvailableMessage
} from './provider-api-error.util'
import {
  probeProviderConnection,
  wrapConnectionTestError
} from './provider-connection-test.util'
import {
  shouldUseOpenAiCompatibleChatSdk,
  shouldUseOpenAiResponsesLanguageModel
} from './reasoning'
import { applyOpenAiThinkingBodyInject } from './reasoning/openai-thinking-inject'

const DEEPSEEK_THINK_OPEN = '<' + 'redacted_thinking>'
const DEEPSEEK_THINK_CLOSE = '<' + '/redacted_thinking>'
const DEEPSEEK_THINK_ALT_OPEN = '<' + 'think>'
const DEEPSEEK_THINK_ALT_CLOSE = '<' + '/think>'

/** 将 assistant 正文中的思考块提取为 reasoning_content，并从 content 中移除 */
export function applyDeepSeekReasoningFields(msg: {
  role?: string
  content?: unknown
  reasoning_content?: string
  tool_calls?: unknown[]
}): void {
  if (msg.role !== 'assistant') {
    return
  }

  if (typeof msg.content === 'string' && msg.content) {
    const patterns: Array<{ open: string; close: string }> = [
      { open: DEEPSEEK_THINK_OPEN, close: DEEPSEEK_THINK_CLOSE },
      { open: DEEPSEEK_THINK_ALT_OPEN, close: DEEPSEEK_THINK_ALT_CLOSE }
    ]
    for (const { open, close } of patterns) {
      const thinkMatch = msg.content.match(
        new RegExp(`${escapeRegExp(open)}\\s*([\\s\\S]*?)\\s*${escapeRegExp(close)}`)
      )
      if (thinkMatch) {
        const reasoningContent = thinkMatch[1]?.trim() ?? ''
        msg.content = msg.content
          .replace(new RegExp(`${escapeRegExp(open)}[\\s\\S]*?${escapeRegExp(close)}\\s*`, 'g'), '')
          .trim()
        if (reasoningContent && msg.reasoning_content == null) {
          msg.reasoning_content = reasoningContent
        }
        break
      }
    }
  }

  // DeepSeek：所有 assistant 消息都需回传 reasoning_content（可为空）
  if (msg.reasoning_content == null) {
    msg.reasoning_content = ''
  }

  if (msg.content === null || msg.content === undefined) {
    msg.content = ''
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Chat Completions 降级兜底：本函数仅在 `/v1/chat/completions` 请求上调用。
 * 若带 tools 且为 OpenAI 系推理模型，强制 reasoning_effort=none。
 */
export function applyChatCompletionsReasoningEffortForTools(body: {
  model?: unknown
  tools?: unknown
  reasoning_effort?: unknown
}): boolean {
  if (!Array.isArray(body.tools) || body.tools.length === 0) return false
  if (typeof body.model !== 'string' || !isOpenAiStyleReasoningModel(body.model)) return false
  if (body.reasoning_effort === 'none') return false
  body.reasoning_effort = 'none'
  return true
}

/**
 * DeepSeek thinking 请求拦截 + Chat 路径 tools 降级。
 */
function createOpenAICompatFetchInterceptor(
  options: { baseURL?: string; providerType?: string },
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
) {
  const baseURL = options.baseURL
  const isDeepSeek = baseURL?.includes('deepseek')

  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const safeInit = sanitizeRequestInit(init)

    const urlStr = typeof url === 'string' ? url : url.toString()
    if (urlStr.includes('/chat/completions') && safeInit?.body && typeof safeInit.body === 'string') {
      try {
        const body = JSON.parse(safeInit.body)
        let mutated = applyChatCompletionsReasoningEffortForTools(body)

        if (applyOpenAiThinkingBodyInject(body)) {
          mutated = true
        }

        if (isDeepSeek && body.messages && Array.isArray(body.messages)) {
          for (const msg of body.messages) {
            applyDeepSeekReasoningFields(msg)
          }
          mutated = true
        }

        if (mutated) {
          safeInit.body = JSON.stringify(body)
        }
      } catch {
        // 解析失败则不干预
      }
    }

    if (!isDeepSeek) {
      return fetchImpl(url, safeInit)
    }

    const response = await fetchImpl(url, safeInit)
    if (!response.ok) {
      const errorBody = await response.text()
      console.error(
        `[FetchDebug] DeepSeek error status=${response.status} body=${errorBody.slice(0, 800)}`
      )
      return new Response(errorBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
    }
    return response
  }
}

/**
 * 通用的兼容 OpenAI 标准 API 格式的 Provider
 */
export class OpenAIAdaptedProvider implements IAIProvider {
  public config: AiProviderModel
  constructor(config: AiProviderModel) {
    this.config = config
  }

  private resolvedBaseUrl(): string {
    return resolveProviderBaseUrl(this.config.id, this.config.type, this.config.baseUrl)
  }

  private _getFetch() {
    const baseURL = this.resolvedBaseUrl() || undefined
    const sanitizedFetch = createSanitizedFetch()
    return createOpenAICompatFetchInterceptor(
      { baseURL, providerType: this.config.type },
      sanitizedFetch
    )
  }

  private _getOfficialSdk() {
    const rotatedKey = sanitizeApiKeyForHttp(getRotatedApiKey(this.config) || this.config.apiKey)
    const baseURL = this.resolvedBaseUrl() || undefined
    return createOpenAI({
      apiKey: rotatedKey,
      baseURL,
      fetch: this._getFetch()
    })
  }

  private _getCompatibleSdk() {
    const rotatedKey = sanitizeApiKeyForHttp(getRotatedApiKey(this.config) || this.config.apiKey)
    const baseURL = this.resolvedBaseUrl() || 'https://api.openai.com/v1'
    return createOpenAICompatible({
      name: 'openaiCompatible',
      apiKey: rotatedKey,
      baseURL,
      includeUsage: true,
      fetch: this._getFetch()
    })
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'gpt-4o'
    const ctx = {
      modelId: targetModel,
      providerType: this.config.type,
      baseUrl: this.resolvedBaseUrl()
    }
    // 官方 OpenAI 推理模型走 Responses；兼容网关 Chat 走 openai-compatible
    if (shouldUseOpenAiResponsesLanguageModel(ctx)) {
      return this._getOfficialSdk().responses(targetModel) as unknown as LanguageModel
    }
    if (shouldUseOpenAiCompatibleChatSdk(ctx)) {
      return this._getCompatibleSdk().chatModel(targetModel) as unknown as LanguageModel
    }
    return this._getOfficialSdk().chat(targetModel) as unknown as LanguageModel
  }

  getEmbeddingModel(modelId?: string): EmbeddingModel {
    const targetModel = modelId || 'text-embedding-3-small'
    if (
      shouldUseOpenAiCompatibleChatSdk({
        providerType: this.config.type,
        baseUrl: this.resolvedBaseUrl()
      })
    ) {
      return this._getCompatibleSdk().textEmbeddingModel(targetModel) as unknown as EmbeddingModel
    }
    return this._getOfficialSdk().textEmbeddingModel(targetModel) as unknown as EmbeddingModel
  }

  async fetchAvailableModels(): Promise<string[]> {
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
      await probeProviderConnection({
        model: this.getLanguageModel(modelToTest),
        modelId: modelToTest,
        providerType: this.config.type,
        baseUrl: this.resolvedBaseUrl()
      })
    } catch (e: unknown) {
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
      throw wrapConnectionTestError(this.config.name, e)
    }
  }
}

// re-export for tests that referenced isOpenAiStyleReasoningModel via this module historically
export { isOpenAiStyleReasoningModel }
