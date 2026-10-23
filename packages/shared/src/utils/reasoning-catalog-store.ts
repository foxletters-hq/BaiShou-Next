import { normalizeModelBaseId } from './provider-vision-models'
import { extractReasoningCatalogFromModelsDevApi } from './reasoning-catalog-extract'
import {
  emptyReasoningCatalogPayload,
  type ReasoningCatalogPayload,
  type ReasoningCatalogRecord
} from './reasoning-catalog.types'
import { getGeneratedReasoningCatalogSnapshot } from './reasoning-models.snapshot'
import type { ReasoningControl, ReasoningEffort } from './reasoning-effort'

const KNOWN_EFFORTS = new Set<ReasoningEffort>([
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
])

let runtimePayload = emptyReasoningCatalogPayload()
let snapshotOverride: ReasoningCatalogPayload | null = null
let epoch = 0
const listeners = new Set<() => void>()

function notify(): void {
  epoch += 1
  for (const listener of listeners) listener()
}

function getSnapshotPayload(): ReasoningCatalogPayload {
  return snapshotOverride ?? getGeneratedReasoningCatalogSnapshot()
}

export function getReasoningCatalogEpoch(): number {
  return epoch
}

export function subscribeReasoningCatalog(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function getRuntimeReasoningCatalogPayload(): ReasoningCatalogPayload {
  return runtimePayload
}

export function applyReasoningCatalogPayload(payload: ReasoningCatalogPayload): void {
  runtimePayload = {
    syncedAt: payload.syncedAt,
    source: payload.source,
    byProvider: payload.byProvider || {},
    byModelId: payload.byModelId || {}
  }
  notify()
}

export function applyReasoningCatalogFromModelsDevApi(
  api: unknown,
  providerIdMap?: Record<string, string>
): ReasoningCatalogPayload {
  const payload = extractReasoningCatalogFromModelsDevApi(api, { providerIdMap })
  applyReasoningCatalogPayload(payload)
  return payload
}

export function clearRuntimeReasoningCatalog(): void {
  runtimePayload = emptyReasoningCatalogPayload()
  notify()
}

/** 单测隔离生成快照；传 null 恢复打包快照 */
export function setReasoningCatalogSnapshotForTest(payload: ReasoningCatalogPayload | null): void {
  snapshotOverride = payload
  notify()
}

export function resetReasoningCatalogForTests(): void {
  runtimePayload = emptyReasoningCatalogPayload()
  snapshotOverride = emptyReasoningCatalogPayload()
  notify()
}

export function mapReasoningCatalogRecordToControl(
  record: ReasoningCatalogRecord | null | undefined
): ReasoningControl | null {
  if (!record?.values?.length) return null
  const efforts = record.values.filter((value): value is ReasoningEffort =>
    KNOWN_EFFORTS.has(value as ReasoningEffort)
  )
  if (efforts.length === 0) return null
  return { mode: 'effort', efforts }
}

function lookupInPayload(
  payload: ReasoningCatalogPayload,
  modelId: string,
  providerTypeOrId?: string
): ReasoningCatalogRecord | null {
  const id = normalizeModelBaseId(modelId)
  if (!id) return null
  const type = (providerTypeOrId || '').toLowerCase()
  if (type && payload.byProvider[type]?.[id]) return payload.byProvider[type][id]
  return payload.byModelId[id] ?? null
}

export function lookupReasoningCatalogRecord(
  modelId: string,
  providerTypeOrId?: string
): ReasoningCatalogRecord | null {
  return (
    lookupInPayload(runtimePayload, modelId, providerTypeOrId) ??
    lookupInPayload(getSnapshotPayload(), modelId, providerTypeOrId)
  )
}

export function lookupReasoningCatalogControl(
  modelId: string,
  providerTypeOrId?: string
): ReasoningControl | null {
  return mapReasoningCatalogRecordToControl(lookupReasoningCatalogRecord(modelId, providerTypeOrId))
}
