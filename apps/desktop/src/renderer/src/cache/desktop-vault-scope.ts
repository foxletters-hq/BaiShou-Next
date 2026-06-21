/** Desktop Renderer 当前 vault scope（与 SWR summary.dashboard 的 scopeKey 对齐） */

let scopeKey: string | null = null
let scopeReady = false
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

async function resolveActiveVaultName(): Promise<string> {
  const api = (window as any).api
  if (api?.vault?.getActive) {
    const active = await api.vault.getActive()
    if (active?.name) return String(active.name)
  }
  return 'Personal'
}

export async function initDesktopVaultScope(): Promise<void> {
  scopeKey = await resolveActiveVaultName()
  scopeReady = true
  notify()
}

export function setDesktopVaultScopeKey(key: string): void {
  scopeKey = key
  scopeReady = true
  notify()
}

export function getDesktopVaultScopeKey(): string {
  return scopeKey ?? 'Personal'
}

export function isDesktopVaultScopeReady(): boolean {
  return scopeReady && scopeKey !== null
}

export function subscribeDesktopVaultScope(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
