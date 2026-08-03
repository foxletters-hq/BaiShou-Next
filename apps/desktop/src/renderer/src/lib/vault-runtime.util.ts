import { deriveLegacyVaultId } from '@baishou/shared'
import { setDesktopVaultScopeKey } from '../cache/desktop-vault-scope'

const ACTIVE_VAULT_STORAGE_KEY = 'baishou_active_vault'

export function persistActiveVaultScopeKey(vaultScopeKey: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_VAULT_STORAGE_KEY, vaultScopeKey)
}

/** @deprecated 兼容旧调用；写入 scope key（优先 vault id） */
export function persistActiveVaultName(vaultName: string): void {
  persistActiveVaultScopeKey(vaultName)
}

export async function switchActiveVault(vaultName: string): Promise<void> {
  const api = (window as any).api?.vault
  if (!api?.switchActive) {
    throw new Error('Vault API unavailable')
  }

  await api.switchActive(vaultName)
  await api.waitForResync?.()
  const active = await api.getActive?.()
  const scopeKey = active?.id?.trim() || deriveLegacyVaultId(vaultName)
  persistActiveVaultScopeKey(scopeKey)
  setDesktopVaultScopeKey(scopeKey)
}

/** @deprecated 使用 switchActiveVault；保留别名避免遗漏调用点 */
export const switchActiveVaultAndReload = switchActiveVault
