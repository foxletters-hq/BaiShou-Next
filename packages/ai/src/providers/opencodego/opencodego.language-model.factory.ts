import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { type AiProviderModel, ProviderType, resolveProviderBaseUrl } from '@baishou/shared'
import { createSanitizedFetch, sanitizeApiKeyForHttp } from '../fetch-header.util'
import { getRotatedApiKey } from '../provider.utils'
import { applyOpenAiThinkingBodyInject } from '../reasoning/openai-thinking-inject'
import { applyDeepSeekReasoningFields } from '../openai.provider'
import { OPENCODE_GO_DEFAULT_BASE_URL } from './opencodego.constants'
import { resolveOpenCodeGoSessionId, withOpenCodeGoHeaders } from './opencodego.headers'
import { resolveOpenCodeGoWireProtocol } from './opencodego.model-protocol'

export function resolveOpenCodeGoBaseUrl(
  config: Pick<AiProviderModel, 'id' | 'type' | 'baseUrl'>
): string {
  return (
    resolveProviderBaseUrl(config.id, config.type || ProviderType.OpenCodeGo, config.baseUrl) ||
    OPENCODE_GO_DEFAULT_BASE_URL
  )
}

function resolveApiKey(config: AiProviderModel): string {
  return sanitizeApiKeyForHttp(getRotatedApiKey(config) || config.apiKey)
}

function createOpenCodeGoOpenAiFetch(fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)) {
  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const nextInit = { ...init }
    const urlStr = typeof url === 'string' ? url : url.toString()
    if (
      urlStr.includes('/chat/completions') &&
      nextInit.body &&
      typeof nextInit.body === 'string'
    ) {
      try {
        const body = JSON.parse(nextInit.body) as Record<string, unknown>
        let mutated = applyOpenAiThinkingBodyInject(body)
        const modelId = typeof body.model === 'string' ? body.model : ''
        if (modelId.toLowerCase().includes('deepseek') && Array.isArray(body.messages)) {
          for (const msg of body.messages) {
            if (msg && typeof msg === 'object') {
              applyDeepSeekReasoningFields(
                msg as Parameters<typeof applyDeepSeekReasoningFields>[0]
              )
              mutated = true
            }
          }
        }
        if (mutated) {
          nextInit.body = JSON.stringify(body)
        }
      } catch {
        // ignore
      }
    }
    return fetchImpl(url, nextInit)
  }
}

export function createOpenCodeGoFetch(
  sessionId?: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): typeof fetch {
  const resolvedSessionId = resolveOpenCodeGoSessionId(sessionId)
  const sanitized = createSanitizedFetch(fetchImpl, { forceOpenCodeSession: true })
  const withDeepSeek = createOpenCodeGoOpenAiFetch(sanitized)
  return async (url, init) => withDeepSeek(url, withOpenCodeGoHeaders(init, resolvedSessionId))
}

/**
 * 按模型 wire 协议创建 Vercel AI SDK LanguageModel。
 * Anthropic 走 messages；Responses 走 @ai-sdk/openai responses；OpenAI 兼容 Chat 走 @ai-sdk/openai-compatible。
 */
export function createOpenCodeGoLanguageModel(
  config: AiProviderModel,
  modelId: string,
  sessionId?: string
): LanguageModel {
  const apiKey = resolveApiKey(config)
  const baseURL = resolveOpenCodeGoBaseUrl(config)
  const fetch = createOpenCodeGoFetch(sessionId)
  const protocol = resolveOpenCodeGoWireProtocol(modelId)

  if (protocol === 'anthropic') {
    const sdk = createAnthropic({ apiKey, baseURL, fetch })
    return sdk(modelId) as unknown as LanguageModel
  }

  if (protocol === 'openai-responses') {
    const sdk = createOpenAI({ apiKey, baseURL, fetch })
    return sdk.responses(modelId) as unknown as LanguageModel
  }

  const sdk = createOpenAICompatible({
    name: 'openaiCompatible',
    apiKey,
    baseURL,
    includeUsage: true,
    fetch
  })
  // OpenAI wire 使用 Chat；思考开关/预算经 fetch 注入；effort 走 openaiCompatible providerOptions
  return sdk.chatModel(modelId) as unknown as LanguageModel
}
