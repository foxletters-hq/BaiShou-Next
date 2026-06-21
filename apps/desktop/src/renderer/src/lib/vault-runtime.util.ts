import { setDesktopVaultScopeKey } from '../cache/desktop-vault-scope'

const ACTIVE_VAULT_STORAGE_KEY = 'baishou_active_vault'

export function persistActiveVaultName(vaultName: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_VAULT_STORAGE_KEY, vaultName)
}

export async function switchActiveVault(vaultName: string): Promise<void> {
  const api = (window as any).api?.vault
  if (!api?.switchActive) {
    throw new Error('Vault API unavailable')
  }

  await api.switchActive(vaultName)
  await api.waitForResync?.()
  persistActiveVaultName(vaultName)
  setDesktopVaultScopeKey(vaultName)
}

/** @deprecated 使用 switchActiveVault；保留别名避免遗漏调用点 */
export const switchActiveVaultAndReload = switchActiveVault
