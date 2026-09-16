import { mobileRagOperationControl } from './mobile-rag-operation-control'

let batchEmbedInFlight: import('./mobile-rag-core.helpers').ControlledDiaryBatchEmbedResult extends infer T
  ? Promise<T> | null
  : never = null
let batchEmbedRerunRequested = false
let reembedInFlight = false

export function isMobileRagBatchBusy(): boolean {
  return batchEmbedInFlight != null || reembedInFlight
}

export function isMobileRagReembedInFlight(): boolean {
  return reembedInFlight
}

export function requestDeferredPostSyncEmbed(): void {
  // 同步后自动嵌入已退休
}

export function isDeferredPostSyncEmbedPending(): boolean {
  return false
}

export async function flushDeferredPostSyncEmbed(): Promise<void> {
  // no-op：不再在 reembedAll / 同步后自动嵌入
}

export function resetMobileRagBatchStateForTests(): void {
  batchEmbedInFlight = null
  batchEmbedRerunRequested = false
  reembedInFlight = false
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
