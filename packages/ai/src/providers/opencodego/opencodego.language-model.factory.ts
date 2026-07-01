import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { type AiProviderModel, ProviderType, resolveProviderBaseUrl } from '@baishou/shared'
import {
  createSanitizedFetch,
  sanitizeApiKeyForHttp
} from '../fetch-header.util'
import { getRotatedApiKey } from '../provider.utils'
import { OPENCODE_GO_DEFAULT_BASE_URL } from './opencodego.constants'
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

/**
 * 按模型 wire 协议创建 Vercel AI SDK LanguageModel。
 * 单一职责：SDK 选择与实例化，不含业务校验。
 */
export function createOpenCodeGoLanguageModel(
  config: AiProviderModel,
  modelId: string
): LanguageModel {
  const apiKey = resolveApiKey(config)
  const baseURL = resolveOpenCodeGoBaseUrl(config)
  const fetch = createSanitizedFetch()
  const protocol = resolveOpenCodeGoWireProtocol(modelId)

  if (protocol === 'anthropic') {
    const sdk = createAnthropic({ apiKey, baseURL, fetch })
    return sdk(modelId) as unknown as LanguageModel
  }

  const sdk = createOpenAI({ apiKey, baseURL, fetch })
  return sdk.chat(modelId) as unknown as LanguageModel
}
