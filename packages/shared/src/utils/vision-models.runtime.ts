import { normalizeModelBaseId } from './provider-vision-models'

const MODELS_DEV_API = 'https://models.dev/api.json'

/** 与 scripts/provider-modelsdev.manifest.json 的 excludeModelIdPatterns 对齐 */
const VISION_EXCLUDE_PATTERNS = [
  /flash-image/i,
  /image-generation/i,
  /image-edit/i,
  /^gpt-image/i,
  /-image-preview/i,
  /imagen/i
]

let runtimeVisionIds: Set<string> | null = null
let overlayRevision = 0
const overlayListeners = new Set<() => void>()

export function getVisionModelsRuntimeRevision(): number {
  return overlayRevision
}

export function subscribeVisionModelsRuntime(listener: () => void): () => void {
  overlayListeners.add(listener)
  return () => {
    overlayListeners.delete(listener)
  }
}

export function getVisionModelsRuntimeOverlay(): string[] {
  return runtimeVisionIds ? [...runtimeVisionIds] : []
}

export function applyVisionModelsRuntimeOverlay(modelIds: readonly string[]): void {
  runtimeVisionIds = new Set(modelIds.map((id) => normalizeModelBaseId(id)).filter(Boolean))
  overlayRevision += 1
  for (const listener of overlayListeners) {
    listener()
  }
}

export function resetVisionModelsRuntimeOverlayForTests(): void {
  runtimeVisionIds = null
  overlayRevision += 1
  for (const listener of overlayListeners) {
    listener()
  }
}

function isExcludedVisionModelId(modelId: string): boolean {
  return VISION_EXCLUDE_PATTERNS.some((pattern) => pattern.test(modelId))
}

function isChatVisionModel(modelId: string, model: unknown): boolean {
  if (isExcludedVisionModelId(modelId)) return false
  const inputs = (model as { modalities?: { input?: unknown } } | undefined)?.modalities?.input
  return Array.isArray(inputs) && inputs.includes('image')
}

/**
 * 从 models.dev api.json 抽出支持图片输入的模型 id（全局，不按供应商过滤）。
 */
export function extractVisionModelIdsFromModelsDev(api: unknown): string[] {
  const ids = new Set<string>()
  if (!api || typeof api !== 'object') return []

  for (const provider of Object.values(api as Record<string, unknown>)) {
    const models = (provider as { models?: Record<string, unknown> } | undefined)?.models
    if (!models) continue
    for (const [modelId, model] of Object.entries(models)) {
      if (isChatVisionModel(modelId, model)) {
        ids.add(modelId)
      }
    }
  }

  return [...ids].sort()
}

export function isVisionModelInRuntime(modelId: string): boolean | undefined {
  if (!modelId || !runtimeVisionIds || runtimeVisionIds.size === 0) return undefined
  return runtimeVisionIds.has(normalizeModelBaseId(modelId)) ? true : undefined
}

export async function refreshVisionModelsFromModelsDev(
  fetcher: typeof fetch = fetch
): Promise<string[]> {
  const response = await fetcher(MODELS_DEV_API, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) {
    throw new Error(`models.dev returned HTTP ${response.status}`)
  }
  const api = await response.json()
  const ids = extractVisionModelIdsFromModelsDev(api)
  applyVisionModelsRuntimeOverlay(ids)
  return ids
}
