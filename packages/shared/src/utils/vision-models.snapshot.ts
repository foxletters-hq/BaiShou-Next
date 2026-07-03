import { VISION_MODELS_SNAPSHOT } from '../data/vision-models.snapshot.generated'
import { normalizeModelBaseId } from './provider-vision-models'

export { VISION_MODELS_SNAPSHOT }

const globalVisionModelIds = new Set(
  VISION_MODELS_SNAPSHOT.byModelId.map((id) => normalizeModelBaseId(id))
)

const providerVisionIndex = new Map<string, ReadonlySet<string>>()
for (const [providerId, modelIds] of Object.entries(VISION_MODELS_SNAPSHOT.byProvider)) {
  providerVisionIndex.set(
    providerId.toLowerCase(),
    new Set(modelIds.map((id) => normalizeModelBaseId(id)))
  )
}

function isListedInSnapshot(modelId: string, providerKey?: string): boolean {
  const base = normalizeModelBaseId(modelId)
  if (!base) return false

  if (globalVisionModelIds.has(base)) {
    return true
  }

  if (providerKey) {
    const providerSet = providerVisionIndex.get(providerKey.toLowerCase())
    if (providerSet?.has(base)) {
      return true
    }
  }

  return false
}

/**
 * models.dev 同步快照：按模型名（归一化后）匹配，不按供应商做否定。
 * 返回 undefined 表示快照未命中，由调用方继续正则等兜底。
 */
export function isVisionModelInSnapshot(
  modelId: string,
  providerKey?: string
): boolean | undefined {
  if (!modelId) return undefined
  return isListedInSnapshot(modelId, providerKey) ? true : undefined
}

export function getVisionModelIdsForProvider(providerKey: string): string[] {
  const ids =
    VISION_MODELS_SNAPSHOT.byProvider[providerKey as keyof typeof VISION_MODELS_SNAPSHOT.byProvider]
  return ids ? [...ids] : []
}
