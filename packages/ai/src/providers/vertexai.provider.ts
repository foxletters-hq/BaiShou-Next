import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { EmbeddingModel, LanguageModel } from 'ai'
import { AiProviderModel, normalizeModelId, PROVIDER_DEFAULT_BASE_URLS } from '@baishou/shared'
import { IAIProvider } from './provider.interface'
import { getRotatedApiKey } from './provider.utils'
import {
  assertAsciiApiKey,
  createSanitizedFetch,
  sanitizeApiKeyForHttp,
  sanitizeRequestHeaders
} from './fetch-header.util'
import { wrapGoogleLanguageModelWithSafetySettings } from './google-safety-settings.util'
import { probeProviderConnection, wrapConnectionTestError } from './provider-connection-test.util'
import { VertexAIEmbeddingModel } from './vertexai-embedding.model'
import {
  buildSnapshotVertexAIModels,
  resolveFallbackVertexAIModels,
  sortVertexModelIdsNewestFirst
} from './vertexai-model-catalog.util'

const VERTEX_AI_DEFAULT_BASE_URL =
  PROVIDER_DEFAULT_BASE_URLS.vertexai || 'https://aiplatform.googleapis.com/v1'

const VERTEX_MODEL_LIST_PAGE_SIZE = 1000
const VERTEX_MODEL_LIST_MAX_PAGES = 4

/**
 * Vertex AI Express Mode（仅 API Key 鉴权）离线兜底模型列表：
 * 由 `@baishou/shared` 中随 `pnpm sync` 自动更新的快照与基础集合生成，包含最新代次模型。
 */
export const VERTEX_AI_DEFAULT_MODELS: readonly string[] = buildSnapshotVertexAIModels()

/**
 * 将用户配置的基础地址规范化为 Vertex AI Google Publisher 根路径，
 * 使 `@ai-sdk/google` 能直接拼出 `/models/{model}:generateContent` 等原生端点。
 */
export function resolveVertexAIPublisherBaseUrl(rawBaseUrl?: string | null): string {
  const trimmed = (rawBaseUrl ?? '').trim().replace(/\/+$/, '')
  const base = trimmed || VERTEX_AI_DEFAULT_BASE_URL

  if (/\/publishers\/[^/]+$/i.test(base)) {
    return base
  }

  try {
    const parsed = new URL(base)
    if (
      parsed.hostname.toLowerCase().endsWith('aiplatform.googleapis.com') &&
      (parsed.pathname === '' || parsed.pathname === '/')
    ) {
      return `${base}/v1/publishers/google`
    }
  } catch {
    // 非标准 URL 字符串按原样拼接 /publishers/google
  }

  return `${base}/publishers/google`
}

function normalizeVertexAIModelId(modelId: string): string {
  const trimmed = (modelId || '').trim()
  const withoutPublisherPrefix = trimmed.replace(/^publishers\/google\/models\//i, '')
  return normalizeModelId(withoutPublisherPrefix)
}

function buildVertexAIModelListEndpoints(publisherBaseUrl: string): string[] {
  const endpoints = [`${publisherBaseUrl}/models`]
  if (/\/v1\/publishers\//i.test(publisherBaseUrl)) {
    const betaBase = publisherBaseUrl.replace(/\/v1\/publishers\//i, '/v1beta1/publishers/')
    endpoints.push(`${betaBase}/models`)
  }
  return endpoints
}

function appendPaginationParams(endpoint: string, pageToken?: string): string {
  const separator = endpoint.includes('?') ? '&' : '?'
  const baseWithSize = `${endpoint}${separator}pageSize=${VERTEX_MODEL_LIST_PAGE_SIZE}`
  return pageToken ? `${baseWithSize}&pageToken=${encodeURIComponent(pageToken)}` : baseWithSize
}

function extractVertexAIModelIds(payload: unknown): {
  models: string[]
  nextPageToken?: string
} {
  if (!payload || typeof payload !== 'object') return { models: [] }
  const record = payload as Record<string, unknown>
  const rawList = Array.isArray(record.publisherModels)
    ? record.publisherModels
    : Array.isArray(record.models)
      ? record.models
      : Array.isArray(record.data)
        ? record.data
        : []

  const seen = new Set<string>()
  const result: string[] = []
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    const rawName =
      typeof entry.name === 'string' ? entry.name : typeof entry.id === 'string' ? entry.id : ''
    const normalized = normalizeVertexAIModelId(rawName)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  const nextPageToken =
    typeof record.nextPageToken === 'string' && record.nextPageToken.trim()
      ? record.nextPageToken.trim()
      : undefined

  return { models: result, nextPageToken }
}

function parseErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const record = body as Record<string, unknown>
  const err = record.error
  if (err && typeof err === 'object') {
    const msg = (err as Record<string, unknown>).message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim()
  }
  return fallback
}

function isExplicitInvalidApiKeyError(status: number, message: string): boolean {
  if (status !== 400) return false
  return /api key not valid|api_key_invalid|invalid api key/i.test(message)
}

export class VertexAIAdaptedProvider implements IAIProvider {
  public config: AiProviderModel

  constructor(config: AiProviderModel) {
    this.config = config
  }

  private _getSdk() {
    const rotatedKey = sanitizeApiKeyForHttp(getRotatedApiKey(this.config) || this.config.apiKey)
    return createGoogleGenerativeAI({
      apiKey: rotatedKey,
      baseURL: resolveVertexAIPublisherBaseUrl(this.config.baseUrl),
      fetch: createSanitizedFetch()
    })
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const rawModel = modelId || this.config.defaultDialogueModel || 'gemini-2.5-flash'
    const targetModel = normalizeVertexAIModelId(rawModel)
    return wrapGoogleLanguageModelWithSafetySettings(
      this._getSdk()(targetModel) as unknown as LanguageModel
    )
  }

  getEmbeddingModel(modelId?: string): EmbeddingModel {
    const rawModel = modelId || 'gemini-embedding-001'
    const targetModel = normalizeVertexAIModelId(rawModel)
    const apiKey = sanitizeApiKeyForHttp(getRotatedApiKey(this.config) || this.config.apiKey)
    return new VertexAIEmbeddingModel(targetModel, {
      provider: 'vertexai',
      baseURL: resolveVertexAIPublisherBaseUrl(this.config.baseUrl),
      apiKey,
      fetch: createSanitizedFetch()
    }) as unknown as EmbeddingModel
  }

  async fetchAvailableModels(): Promise<string[]> {
    const apiKey = sanitizeApiKeyForHttp(getRotatedApiKey(this.config) || this.config.apiKey)
    if (!apiKey) return []

    const publisherBaseUrl = resolveVertexAIPublisherBaseUrl(this.config.baseUrl)
    const endpoints = buildVertexAIModelListEndpoints(publisherBaseUrl)
    const sanitizedFetch = createSanitizedFetch()
    const headers = sanitizeRequestHeaders({ 'x-goog-api-key': apiKey })

    for (const endpoint of endpoints) {
      const collected: string[] = []
      let pageToken: string | undefined
      let endpointUnsupported = false

      for (let page = 0; page < VERTEX_MODEL_LIST_MAX_PAGES; page++) {
        const res = await sanitizedFetch(appendPaginationParams(endpoint, pageToken), { headers })
        if (res.ok) {
          const data = await res.json()
          const { models, nextPageToken } = extractVertexAIModelIds(data)
          collected.push(...models)
          if (!nextPageToken || models.length === 0) {
            break
          }
          pageToken = nextPageToken
          continue
        }

        let errMessage = res.statusText || `HTTP ${res.status}`
        try {
          const errBody = await res.json()
          errMessage = parseErrorMessage(errBody, errMessage)
        } catch {
          // 忽略非 JSON 错误体
        }

        if (isExplicitInvalidApiKeyError(res.status, errMessage)) {
          throw new Error(`Failed to fetch Vertex AI models: ${res.status} ${errMessage}`)
        }

        // Express Mode 下 404/401/403 属于列表端点未对 API Key 开放的正常情况，继续尝试或回退动态目录
        if (res.status === 404 || res.status === 401 || res.status === 403) {
          endpointUnsupported = true
          break
        }

        throw new Error(`Failed to fetch Vertex AI models: ${res.status} ${errMessage}`)
      }

      if (!endpointUnsupported && collected.length > 0) {
        return sortVertexModelIdsNewestFirst(collected)
      }
    }

    return resolveFallbackVertexAIModels(sanitizedFetch)
  }

  async testConnection(testModelId?: string): Promise<void> {
    const rawModelToTest =
      testModelId ||
      this.config.defaultDialogueModel ||
      (this.config.enabledModels && this.config.enabledModels.length > 0
        ? this.config.enabledModels[0]
        : null) ||
      (this.config.models && this.config.models.length > 0 ? this.config.models[0] : null) ||
      'gemini-2.5-flash'
    const modelToTest = normalizeVertexAIModelId(rawModelToTest)

    assertAsciiApiKey(getRotatedApiKey(this.config) || this.config.apiKey)

    try {
      await probeProviderConnection({
        model: this.getLanguageModel(modelToTest),
        modelId: modelToTest,
        providerType: this.config.type,
        baseUrl: this.config.baseUrl
      })
    } catch (e: unknown) {
      throw wrapConnectionTestError(this.config.name, e)
    }
  }
}
