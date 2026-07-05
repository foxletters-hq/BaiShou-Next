/** Desktop Renderer 当前 vault scope（与 SWR summary.dashboard 的 scopeKey 对齐） */

const ACTIVE_VAULT_STORAGE_KEY = 'baishou_active_vault'

let scopeKey: string | null = null
let scopeRevision = 0
let scopeReady = false
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

function readPersistedVaultName(): string | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(ACTIVE_VAULT_STORAGE_KEY)
  return stored?.trim() ? stored : null
}

async function resolveActiveVaultName(): Promise<string> {
  const api = (window as any).api
  if (api?.vault?.getActive) {
    const active = await api.vault.getActive()
    if (active?.name) return String(active.name)
  }
  return readPersistedVaultName() ?? 'Personal'
}

export async function initDesktopVaultScope(): Promise<void> {
  const persisted = readPersistedVaultName()
  if (persisted) {
    scopeKey = persisted
    scopeReady = true
    notify()
  }

  scopeKey = await resolveActiveVaultName()
  scopeReady = true
  notify()
}

export function setDesktopVaultScopeKey(key: string): void {
  if (scopeKey === key) {
    scopeReady = true
    return
  }
  scopeKey = key
  scopeRevision += 1
  scopeReady = true
  notify()
}

/** 存储根目录变更后强制刷新 scope（vault 名称可能不变，但仍需失效页面缓存） */
export async function refreshDesktopVaultScopeAfterStorageRootChange(): Promise<void> {
  scopeKey = await resolveActiveVaultName()
  scopeRevision += 1
  scopeReady = true
  notify()
}

export function getDesktopVaultScopeKey(): string {
  return scopeKey ?? readPersistedVaultName() ?? 'Personal'
}

export function getDesktopVaultScopeRevision(): number {
  return scopeRevision
}

export function isDesktopVaultScopeReady(): boolean {
  return scopeReady && scopeKey !== null
}

export function subscribeDesktopVaultScope(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
