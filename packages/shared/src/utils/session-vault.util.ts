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

/** 会话落盘目标工作区：优先会话自身 vault（且磁盘存在），否则活跃 vault */
export function resolveSessionFlushTargetVault(
  sessionVaultName: string | null | undefined,
  activeVaultName: string | null | undefined,
  diskVaultNames: readonly string[]
): string | null {
  const disk = new Set(diskVaultNames.map((n) => n.trim()).filter(Boolean))
  const raw = sessionVaultName?.trim()
  if (raw && raw !== 'default' && disk.has(raw)) return raw
  const active = activeVaultName?.trim()
  if (active && (disk.size === 0 || disk.has(active))) return active
  if (active) return active
  if (raw && disk.has(raw)) return raw
  return diskVaultNames.map((n) => n.trim()).find(Boolean) ?? null
}
