import type { VaultInfo } from './index'

export const WORKSPACE_RECENT_LIMIT = 3

export function toVaultTimestamp(value: Date | string | undefined): number {
  if (!value) return 0
  try {
    return (typeof value === 'string' ? new Date(value) : value).getTime()
  } catch {
    return 0
  }
}

export function pickRecentVaults(vaults: VaultInfo[], activeVault: VaultInfo | null): VaultInfo[] {
  const sorted = [...vaults].sort(
    (a, b) => toVaultTimestamp(b.lastAccessedAt) - toVaultTimestamp(a.lastAccessedAt)
  )
  const picked: VaultInfo[] = []
  for (const vault of sorted) {
    if (activeVault && vault.name === activeVault.name) continue
    if (picked.length >= WORKSPACE_RECENT_LIMIT) break
    picked.push(vault)
  }
  return picked
}
