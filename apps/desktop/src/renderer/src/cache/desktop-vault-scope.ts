/** Desktop Renderer 当前 vault scope（与 SWR summary.dashboard 的 scopeKey 对齐） */

import { deriveLegacyVaultId, isVaultId } from '@baishou/shared'

const ACTIVE_VAULT_STORAGE_KEY = 'baishou_active_vault'

let scopeKey: string | null = null
let scopeRevision = 0
let scopeReady = false
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

function readPersistedVaultScopeKey(): string | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(ACTIVE_VAULT_STORAGE_KEY)
  return stored?.trim() ? stored : null
}

function normalizePersistedScopeKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return deriveLegacyVaultId('Personal')
  return isVaultId(trimmed) ? trimmed : deriveLegacyVaultId(trimmed)
}

async function resolveActiveVaultScopeKey(): Promise<string> {
  const api = (window as any).api
  if (api?.vault?.getActive) {
    const active = await api.vault.getActive()
    if (active?.id) return String(active.id)
  }
  const persisted = readPersistedVaultScopeKey()
  if (persisted) return normalizePersistedScopeKey(persisted)
  return deriveLegacyVaultId('Personal')
}

export async function initDesktopVaultScope(): Promise<void> {
  const persisted = readPersistedVaultScopeKey()
  if (persisted) {
    scopeKey = normalizePersistedScopeKey(persisted)
    scopeReady = true
    notify()
  }

  scopeKey = await resolveActiveVaultScopeKey()
  scopeReady = true
  notify()
}

export function setDesktopVaultScopeKey(key: string): void {
  const next = key.trim() || deriveLegacyVaultId('Personal')
  const scopeId = isVaultId(next) ? next : deriveLegacyVaultId(next)
  // mutation 触发 remount 早于 switchActiveVault 的 persist；先写 localStorage 避免快照读到旧 vault
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACTIVE_VAULT_STORAGE_KEY, scopeId)
  }
  if (scopeKey === scopeId) {
    scopeReady = true
    return
  }
  scopeKey = scopeId
  scopeRevision += 1
  scopeReady = true
  notify()
}

/** 存储根目录变更后强制刷新 scope（vault 名称可能不变，但仍需失效页面缓存） */
export async function refreshDesktopVaultScopeAfterStorageRootChange(): Promise<void> {
  const next = await resolveActiveVaultScopeKey()
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACTIVE_VAULT_STORAGE_KEY, next)
  }
  scopeKey = next
  scopeRevision += 1
  scopeReady = true
  notify()
}

export function getDesktopVaultScopeKey(): string {
  const raw = scopeKey ?? readPersistedVaultScopeKey() ?? 'Personal'
  return isVaultId(raw) ? raw : deriveLegacyVaultId(raw)
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
