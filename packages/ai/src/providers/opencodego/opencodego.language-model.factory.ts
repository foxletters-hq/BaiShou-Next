import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { type AiProviderModel, ProviderType, resolveProviderBaseUrl } from '@baishou/shared'
import { createSanitizedFetch, sanitizeApiKeyForHttp } from '../fetch-header.util'
import { getRotatedApiKey } from '../provider.utils'
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
        let mutated = false
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
  const sanitized = createSanitizedFetch(fetchImpl)
  const withDeepSeek = createOpenCodeGoOpenAiFetch(sanitized)
  return async (url, init) => withDeepSeek(url, withOpenCodeGoHeaders(init, resolvedSessionId))
}

/**
 * 按模型 wire 协议创建 Vercel AI SDK LanguageModel。
 * 单一职责：SDK 选择与实例化，不含业务校验。
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

  const sdk = createOpenAI({
    apiKey,
    baseURL,
    fetch
  })
  if (protocol === 'openai-responses') {
    return sdk.responses(modelId) as unknown as LanguageModel
  }
  return sdk.chat(modelId) as unknown as LanguageModel
}
