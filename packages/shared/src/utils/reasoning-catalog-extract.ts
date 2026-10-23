import { normalizeModelBaseId } from './provider-vision-models'
import {
  emptyReasoningCatalogPayload,
  type ReasoningCatalogPayload,
  type ReasoningCatalogRecord
} from './reasoning-catalog.types'

type ModelsDevEffortOption = {
  type?: unknown
  values?: unknown
}

export type ExtractReasoningCatalogOptions = {
  /** 远端供应商 id → 本地供应商 id */
  providerIdMap?: Record<string, string>
  /** 为 true 时只收 providerIdMap 里的供应商（编译期快照用） */
  onlyMappedProviders?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function collectReasoningCatalogRecord(model: unknown): ReasoningCatalogRecord | null {
  const rec = asRecord(model)
  if (!rec) return null
  const rawOptions = rec.reasoning_options
  if (!Array.isArray(rawOptions)) return null

  for (const item of rawOptions) {
    const opt = item as ModelsDevEffortOption
    if (opt?.type !== 'effort' || !Array.isArray(opt.values)) continue
    const values = [
      ...new Set(
        opt.values.filter(
          (value): value is string => typeof value === 'string' && Boolean(value.trim())
        )
      )
    ]
    if (values.length === 0) continue
    return { values }
  }
  return null
}

function writeRecord(
  payload: ReasoningCatalogPayload,
  providerId: string,
  modelId: string,
  record: ReasoningCatalogRecord
): void {
  const base = normalizeModelBaseId(modelId)
  if (!base) return
  const providerKey = providerId.toLowerCase()
  if (!payload.byProvider[providerKey]) payload.byProvider[providerKey] = {}
  payload.byProvider[providerKey][base] = record
  payload.byModelId[base] = record
}

/**
 * 从公开模型目录 JSON 抽出带 effort 档位的记录。
 */
export function extractReasoningCatalogFromModelsDevApi(
  api: unknown,
  options?: ExtractReasoningCatalogOptions | Record<string, string>
): ReasoningCatalogPayload {
  const payload = emptyReasoningCatalogPayload()
  const root = asRecord(api)
  if (!root) return payload

  const normalizedOptions: ExtractReasoningCatalogOptions = isProviderIdMap(options)
    ? { providerIdMap: options }
    : options || {}
  const providerIdMap = normalizedOptions.providerIdMap || {}

  const providerEntries = normalizedOptions.onlyMappedProviders
    ? Object.keys(providerIdMap)
        .map((devId) => [devId, root[devId]] as const)
        .filter(([, value]) => value != null)
    : Object.entries(root)

  for (const [devProviderId, providerValue] of providerEntries) {
    const provider = asRecord(providerValue)
    const models = asRecord(provider?.models)
    if (!models) continue
    const localProviderId = providerIdMap[devProviderId] || devProviderId
    for (const [modelId, model] of Object.entries(models)) {
      const record = collectReasoningCatalogRecord(model)
      if (!record) continue
      writeRecord(payload, localProviderId, modelId, record)
    }
  }
  return payload
}

function isProviderIdMap(
  value: ExtractReasoningCatalogOptions | Record<string, string> | undefined
): value is Record<string, string> {
  if (!value || typeof value !== 'object') return false
  return !('providerIdMap' in value) && !('onlyMappedProviders' in value)
}
