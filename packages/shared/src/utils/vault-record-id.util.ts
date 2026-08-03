import { deriveLegacyVaultId, isVaultId } from './vault-id.util'

/**
 * 从 JSONL / Session JSON 记录解析稳定 vaultId。
 * 优先显式 vaultId；否则用路径/活跃上下文推导名；最后才从 vaultName 派生（存量）。
 * 逻辑不得把 vaultName 当唯一真值。
 */
export function resolveVaultIdFromRecord(params: {
  vaultId?: string | null
  vaultName?: string | null
  /** 从文件路径或活跃仓库推导出的显示名 / 目录名 */
  inferredVaultName?: string | null
}): string {
  const explicit = params.vaultId?.trim()
  if (explicit && isVaultId(explicit)) return explicit
  if (explicit) return isVaultId(explicit) ? explicit : deriveLegacyVaultId(explicit)

  const inferred = params.inferredVaultName?.trim()
  if (inferred) return deriveLegacyVaultId(inferred)

  const snapshotName = params.vaultName?.trim()
  if (snapshotName) return deriveLegacyVaultId(snapshotName)

  return deriveLegacyVaultId('Personal')
}

export type VaultIdentity = { id: string; name: string }

/**
 * 组装工具/IPC 用的 { id, name }：id 走稳定身份，name 仅展示。
 */
export function resolveVaultIdentity(params: {
  vaultId?: string | null
  vaultName?: string | null
  resolveNameById?: (id: string) => string | null | undefined
  defaultName?: string
}): VaultIdentity {
  const defaultName = params.defaultName?.trim() || 'Personal'
  const idRaw = params.vaultId?.trim()
  if (idRaw && isVaultId(idRaw)) {
    const name =
      params.resolveNameById?.(idRaw)?.trim() ||
      params.vaultName?.trim() ||
      defaultName
    return { id: idRaw, name }
  }
  const name = params.vaultName?.trim() || defaultName
  if (idRaw) return { id: idRaw, name }
  return { id: deriveLegacyVaultId(name), name }
}
