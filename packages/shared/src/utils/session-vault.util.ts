/** 会话归属的 vault 标识：统一为 vault 名称（如 Personal） */
export function sessionBelongsToActiveVault(
  sessionVaultName: string | null | undefined,
  activeVaultName: string,
  activeVaultPath?: string | null
): boolean {
  if (!sessionVaultName || sessionVaultName === 'default') return true
  if (sessionVaultName === activeVaultName) return true
  if (activeVaultPath && sessionVaultName === activeVaultPath) return true
  if (activeVaultPath && sessionVaultName.replace(/\\/g, '/').endsWith(`/${activeVaultName}`)) {
    return true
  }
  return false
}
