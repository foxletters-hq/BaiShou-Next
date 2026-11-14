import { EmbeddingModelV3, TooManyEmbeddingValuesForCallError } from '@ai-sdk/provider'
import { sanitizeRequestHeaders } from './fetch-header.util'

export type VertexAIEmbeddingTaskType =
  | 'RETRIEVAL_QUERY'
  | 'RETRIEVAL_DOCUMENT'
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING'
  | 'QUESTION_ANSWERING'
  | 'FACT_VERIFICATION'
  | 'CODE_RETRIEVAL_QUERY'

export interface VertexAIEmbeddingConfig {
  provider: string
  baseURL: string
  apiKey: string
  fetch: typeof fetch
}

interface VertexAIPredictResponse {
  predictions?: Array<{
    embeddings?: {
      values?: number[]
      statistics?: {
        token_count?: number
      }
    }
  }>
  error?: {
    message?: string
  }
  message?: string
}

function resolveVertexEmbeddingOptions(providerOptions?: Record<string, unknown>): {
  taskType?: string
  outputDimensionality?: number
} {
  if (!providerOptions || typeof providerOptions !== 'object') return {}
  const googleOpts = providerOptions.google as Record<string, unknown> | undefined
  const vertexOpts = providerOptions.vertex as Record<string, unknown> | undefined
  const merged = { ...(googleOpts ?? {}), ...(vertexOpts ?? {}) }

  const rawTaskType = merged.taskType ?? merged.task_type
  const taskType =
    typeof rawTaskType === 'string' && rawTaskType.trim() ? rawTaskType.trim() : undefined
  const rawDim = merged.outputDimensionality
  const outputDimensionality =
    typeof rawDim === 'number' && Number.isFinite(rawDim) && rawDim > 0 ? rawDim : undefined

  return { taskType, outputDimensionality }
}

function createVertexEmbeddingHttpError(status: number, message: string): Error {
  const err = new Error(`Vertex AI embedding request failed (${status}): ${message}`) as Error & {
    statusCode: number
    status: number
  }
  err.statusCode = status
  err.status = status
  return err
}

/**
 * Vertex AI 原生 `:predict` Embedding 模型适配器。
 * 复用双端安全 fetch 与 `x-goog-api-key` 认证，支持 `gemini-embedding-001` 等模型及 `task_type` 参数。
 */
export class VertexAIEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = 'v3' as const
  readonly modelId: string
  readonly maxEmbeddingsPerCall = 250
  readonly supportsParallelCalls = true

  private readonly config: VertexAIEmbeddingConfig

  get provider(): string {
    return this.config.provider
  }

  constructor(modelId: string, config: VertexAIEmbeddingConfig) {
    this.modelId = modelId
    this.config = config
  }

  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions
  }: Parameters<EmbeddingModelV3['doEmbed']>[0]): Promise<
    Awaited<ReturnType<EmbeddingModelV3['doEmbed']>>
  > {
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values
      })
    }

    if (values.length === 0) {
      return {
        embeddings: [],
        warnings: []
      }
    }

    const { taskType, outputDimensionality } = resolveVertexEmbeddingOptions(
      providerOptions as Record<string, unknown> | undefined
    )

    const instances = values.map((content) =>
      taskType ? { content, task_type: taskType } : { content }
    )
    const body: Record<string, unknown> = { instances }
    if (outputDimensionality !== undefined) {
      body.parameters = { outputDimensionality }
    }

    const baseHeaders = new Headers(
      sanitizeRequestHeaders({
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey
      })
    )
    if (headers) {
      const extra = sanitizeRequestHeaders(headers)
      if (extra instanceof Headers) {
        extra.forEach((value, key) => {
          baseHeaders.set(key, value)
        })
      }
    }

    const endpoint = `${this.config.baseURL.replace(/\/+$/, '')}/models/${this.modelId}:predict`
    const response = await this.config.fetch(endpoint, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(body),
      signal: abortSignal
    })

    if (!response.ok) {
      let errMessage = response.statusText || `HTTP ${response.status}`
      try {
        const errBody = (await response.json()) as VertexAIPredictResponse
        if (errBody?.error?.message) {
          errMessage = errBody.error.message
        } else if (errBody?.message) {
          errMessage = errBody.message
        }
      } catch {
        // 忽略非 JSON 错误响应体
      }
      throw createVertexEmbeddingHttpError(response.status, errMessage)
    }

    const data = (await response.json()) as VertexAIPredictResponse
    const predictions = Array.isArray(data.predictions) ? data.predictions : []
    const embeddings = predictions.map((item) => item?.embeddings?.values ?? [])

    if (embeddings.length !== values.length || embeddings.some((vec) => vec.length === 0)) {
      throw new Error(
        `Vertex AI embedding response mismatch: expected ${values.length} vectors, got ${embeddings.length}`
      )
    }

    const totalTokens = predictions.reduce(
      (sum, item) => sum + (item?.embeddings?.statistics?.token_count ?? 0),
      0
    )

    const responseHeaders: Record<string, string> = {}
    response.headers?.forEach?.((value, key) => {
      responseHeaders[key] = value
    })

    return {
      embeddings,
      usage: totalTokens > 0 ? { tokens: totalTokens } : undefined,
      warnings: [],
      response: {
        headers: responseHeaders,
        body: data
      }
    }
  }
}
