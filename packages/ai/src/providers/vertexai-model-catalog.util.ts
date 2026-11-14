import {
  REASONING_MODELS_SNAPSHOT,
  VISION_MODELS_SNAPSHOT,
  isEmbeddingModel
} from '@baishou/shared'

const MODELS_DEV_API_URL = 'https://models.dev/api.json'
const MODELS_DEV_FETCH_TIMEOUT_MS = 4000

const BASELINE_VERTEX_MODELS: readonly string[] = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-embedding-001',
  'text-embedding-004'
]

const EXCLUDED_VERTEX_MODEL_PATTERNS: readonly RegExp[] = [
  /-image(?:-preview)?$/i,
  /^imagen/i,
  /nano-banana/i,
  /-tts$/i,
  /native-audio/i
]

/**
 * 判断模型 ID 是否属于 Vertex AI `publishers/google/models/*` 支持 API Key 直接调用的模型。
 * 排除带第三方命名空间（如 `meta/*`、`xai/*`）或 Claude MaaS（`claude-*`）以及纯生图/语音模型。
 */
export function isSupportedVertexGooglePublisherModelId(modelId: string): boolean {
  const id = (modelId || '').trim()
  if (!id || id.includes('/') || id.includes('@')) return false
  if (!/^(?:gemini-|text-embedding-|text-multilingual-embedding-)/i.test(id)) {
    return false
  }
  return !EXCLUDED_VERTEX_MODEL_PATTERNS.some((pattern) => pattern.test(id))
}

function parseGeminiVersionTuple(modelId: string): [number, number] {
  const match = /^gemini-(\d+)(?:\.(\d+))?/i.exec(modelId)
  if (!match) return [0, 0]
  const major = Number.parseInt(match[1] ?? '0', 10)
  const minor = match[2] !== undefined ? Number.parseInt(match[2], 10) : 0
  return [Number.isFinite(major) ? major : 0, Number.isFinite(minor) ? minor : 0]
}

function resolveGeminiTierRank(modelId: string): number {
  const lower = modelId.toLowerCase()
  if (lower.includes('-pro')) return 3
  if (lower.includes('flash-lite')) return 1
  if (lower.includes('-flash')) return 2
  return 2
}

/**
 * 将 Vertex AI 模型按「对话模型优先、最新代次优先、Embedding 模型置底」排序，
 * 避免新模型被淹没在早期旧模型之后。
 */
export function sortVertexModelIdsNewestFirst(modelIds: Iterable<string>): string[] {
  const unique = new Set<string>()
  for (const raw of modelIds) {
    const trimmed = (raw || '').trim()
    if (trimmed) unique.add(trimmed)
  }

  return [...unique].sort((a, b) => {
    const aEmbed = isEmbeddingModel(a)
    const bEmbed = isEmbeddingModel(b)
    if (aEmbed !== bEmbed) return aEmbed ? 1 : -1

    const [aMajor, aMinor] = parseGeminiVersionTuple(a)
    const [bMajor, bMinor] = parseGeminiVersionTuple(b)
    if (aMajor !== bMajor) return bMajor - aMajor
    if (aMinor !== bMinor) return bMinor - aMinor

    const aTier = resolveGeminiTierRank(a)
    const bTier = resolveGeminiTierRank(b)
    if (aTier !== bTier) return bTier - aTier

    const aPreview = /preview|customtools/i.test(a) ? 1 : 0
    const bPreview = /preview|customtools/i.test(b) ? 1 : 0
    if (aPreview !== bPreview) return aPreview - bPreview

    return a.localeCompare(b)
  })
}

/**
 * 从 `@baishou/shared` 已同步的视觉/推理模型快照与基础集合中聚合 Vertex AI 可用模型。
 * 快照随 `pnpm sync` 更新，包含最新发布的 Gemini 3.x / 4.x 等版本。
 */
export function buildSnapshotVertexAIModels(): string[] {
  const candidates = new Set<string>(BASELINE_VERTEX_MODELS)

  const visionVertex = VISION_MODELS_SNAPSHOT.byProvider?.vertexai ?? []
  for (const id of visionVertex) {
    if (isSupportedVertexGooglePublisherModelId(id)) {
      candidates.add(id)
    }
  }

  const reasoningProviders = (
    REASONING_MODELS_SNAPSHOT as unknown as {
      providers?: Record<string, Record<string, unknown>>
    }
  ).providers
  const reasoningVertex = reasoningProviders?.vertexai
    ? Object.keys(reasoningProviders.vertexai)
    : []
  for (const id of reasoningVertex) {
    if (isSupportedVertexGooglePublisherModelId(id)) {
      candidates.add(id)
    }
  }

  return sortVertexModelIdsNewestFirst(candidates)
}

export function extractVertexModelsFromModelsDevPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const vertexNode = (payload as Record<string, unknown>)['google-vertex']
  if (!vertexNode || typeof vertexNode !== 'object') return []
  const modelsMap = (vertexNode as Record<string, unknown>).models
  if (!modelsMap || typeof modelsMap !== 'object') return []

  const extracted: string[] = []
  for (const modelId of Object.keys(modelsMap as Record<string, unknown>)) {
    if (isSupportedVertexGooglePublisherModelId(modelId)) {
      extracted.push(modelId)
    }
  }
  return extracted
}

/**
 * 在线从 `models.dev` 拉取最新 `google-vertex` 模型列表并与本地快照合并；
 * 若离线或超时则静默回退到本地最新快照列表。
 */
export async function resolveFallbackVertexAIModels(fetchFn: typeof fetch): Promise<string[]> {
  const snapshotModels = buildSnapshotVertexAIModels()
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), MODELS_DEV_FETCH_TIMEOUT_MS)

    const fetcher =
      ((globalThis as { customNetFetch?: typeof fetch }).customNetFetch as
        | typeof fetch
        | undefined) ?? fetchFn

    const res = await fetcher(MODELS_DEV_API_URL, { signal: controller.signal })
    if (!res.ok) {
      return snapshotModels
    }

    const data = await res.json()
    const liveModels = extractVertexModelsFromModelsDevPayload(data)
    if (liveModels.length === 0) {
      return snapshotModels
    }

    return sortVertexModelIdsNewestFirst([...liveModels, ...snapshotModels])
  } catch {
    return snapshotModels
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
  }
}
