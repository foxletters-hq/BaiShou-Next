import { REASONING_MODELS_SNAPSHOT } from '../data/reasoning-models.snapshot.generated'
import type { ReasoningCatalogPayload, ReasoningCatalogRecord } from './reasoning-catalog.types'

export { REASONING_MODELS_SNAPSHOT }

export function getGeneratedReasoningCatalogSnapshot(): ReasoningCatalogPayload {
  const snap = REASONING_MODELS_SNAPSHOT as unknown as ReasoningCatalogPayload
  return {
    syncedAt: snap.syncedAt,
    source: snap.source,
    byProvider: { ...(snap.byProvider || {}) } as Record<
      string,
      Record<string, ReasoningCatalogRecord>
    >,
    byModelId: { ...(snap.byModelId || {}) } as Record<string, ReasoningCatalogRecord>
  }
}
