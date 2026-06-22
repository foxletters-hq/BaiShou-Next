import type { ShadowIndexSyncService } from '@baishou/core-mobile'

type ScanStateListener = (scanning: boolean) => void

let shadowVaultScanning = false
const listeners = new Set<ScanStateListener>()

export function getShadowVaultScanning(): boolean {
  return shadowVaultScanning
}

function emitShadowVaultScanning(scanning: boolean): void {
  if (shadowVaultScanning === scanning) return
  shadowVaultScanning = scanning
  for (const listener of listeners) {
    try {
      listener(scanning)
    } catch {
      /* ignore */
    }
  }
}

export function subscribeShadowVaultScanning(listener: ScanStateListener): () => void {
  listeners.add(listener)
  listener(shadowVaultScanning)
  return () => {
    listeners.delete(listener)
  }
}

let boundUnsubscribe: (() => void) | null = null

/** 将 core 层 fullScanVault 扫描状态同步到移动端 UI 索引闸门 */
export function bindShadowVaultScanState(service: ShadowIndexSyncService): void {
  boundUnsubscribe?.()
  boundUnsubscribe = service.onScanStateChange((scanning) => {
    emitShadowVaultScanning(scanning)
  })
}

export function unbindShadowVaultScanState(): void {
  boundUnsubscribe?.()
  boundUnsubscribe = null
  emitShadowVaultScanning(false)
}
