import { mobileRagOperationControl } from './mobile-rag-operation-control'

let batchEmbedInFlight: import('./mobile-rag-core.helpers').ControlledDiaryBatchEmbedResult extends infer T
  ? Promise<T> | null
  : never = null
let batchEmbedRerunRequested = false
let reembedInFlight = false
let deferredPostSyncEmbed = false

export function isMobileRagBatchBusy(): boolean {
  return batchEmbedInFlight != null || reembedInFlight
}

export function isMobileRagReembedInFlight(): boolean {
  return reembedInFlight
}

export function requestDeferredPostSyncEmbed(): void {
  deferredPostSyncEmbed = true
}

export function isDeferredPostSyncEmbedPending(): boolean {
  return deferredPostSyncEmbed
}

export async function flushDeferredPostSyncEmbed(): Promise<void> {
  if (!deferredPostSyncEmbed) return
  deferredPostSyncEmbed = false
  const { schedulePostSyncDiaryBatchEmbed } = await import('./mobile-post-sync-diary-embed.service')
  schedulePostSyncDiaryBatchEmbed()
}

export function resetMobileRagBatchStateForTests(): void {
  batchEmbedInFlight = null
  batchEmbedRerunRequested = false
  reembedInFlight = false
  deferredPostSyncEmbed = false
  mobileRagOperationControl.reset()
}

export function getBatchEmbedInFlight() {
  return batchEmbedInFlight
}
export function setBatchEmbedInFlight(p: typeof batchEmbedInFlight) {
  batchEmbedInFlight = p
}
export function isBatchEmbedRerunRequested() {
  return batchEmbedRerunRequested
}
export function setBatchEmbedRerunRequested(v: boolean) {
  batchEmbedRerunRequested = v
}
export function clearBatchEmbedRerunRequested() {
  batchEmbedRerunRequested = false
}
export function isReembedInFlight() {
  return reembedInFlight
}
export function setReembedInFlight(v: boolean) {
  reembedInFlight = v
}
