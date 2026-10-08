import { sanitizeApiKeyForHttp } from '../fetch-header.util'
import { OPENCODE_GO_MODELS_SESSION_ID } from './opencodego.constants'
import {
  createOpenCodeGoFetch,
  resolveOpenCodeGoBaseUrl
} from './opencodego.language-model.factory'
import type { AiProviderModel } from '@baishou/shared'

interface OpenCodeGoModelsResponse {
  data?: Array<{ id?: string }>
}

/**
 * 从 OpenCode Go `/v1/models` 拉取可用模型列表。
 */
export async function fetchOpenCodeGoModelIds(
  config: Pick<AiProviderModel, 'id' | 'type' | 'baseUrl' | 'apiKey'>,
  apiKeyOverride?: string
): Promise<string[]> {
  const base = resolveOpenCodeGoBaseUrl(config)
  const endpoint = `${base.replace(/\/$/, '')}/models`
  const apiKey = sanitizeApiKeyForHttp(apiKeyOverride ?? config.apiKey ?? '')

  const headers: Record<string, string> = {}
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const response = await createOpenCodeGoFetch(OPENCODE_GO_MODELS_SESSION_ID)(endpoint, {
    headers
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenCode Go models: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as OpenCodeGoModelsResponse
  if (!payload.data || !Array.isArray(payload.data)) {
    throw new Error('Invalid OpenCode Go models response: expected data array')
  }

  return payload.data.map((entry) => entry.id?.trim()).filter((id): id is string => Boolean(id))
}
