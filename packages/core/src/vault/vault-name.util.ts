/** 工作空间名称中不允许的字符（路径 / URI 安全） */
const INVALID_VAULT_NAME_REGEX = /[\\/:%#?*\x00-\x1f]/

export type VaultNameValidationResult =
  | { ok: true; name: string }
  | { ok: false; reason: 'empty' | 'invalid_chars' }

export type VaultNameConflictKind = 'exact' | 'case' | 'directory'

export type VaultNameConflict = {
  existing: string
  kind: VaultNameConflictKind
}

export function normalizeVaultNameInput(name: string): string {
  return name.trim()
}

/** 用于跨平台判重：Windows / 默认 macOS 目录名大小写不敏感 */
export function normalizeVaultNameForCompare(name: string): string {
  return normalizeVaultNameInput(name).toLocaleLowerCase()
}

/**
 * 在已有仓库名中查找与候选名冲突的项。
 * - exact：完全相同
 * - case：仅大小写不同（会撞同一磁盘目录）
 * - directory：消毒后的目录名相同（历史非法名与合法名可能撞盘）
 */
export function findConflictingVaultName(
  candidate: string,
  existingNames: readonly string[]
): VaultNameConflict | null {
  const candidateRaw = normalizeVaultNameInput(candidate)
  if (!candidateRaw) return null

  const candidateCase = normalizeVaultNameForCompare(candidateRaw)
  const candidateDir = normalizeVaultNameForCompare(sanitizeVaultDirectoryName(candidateRaw))

  for (const existing of existingNames) {
    const existingRaw = normalizeVaultNameInput(existing)
    if (!existingRaw) continue
    if (existingRaw === candidateRaw) {
      return { existing: existingRaw, kind: 'exact' }
    }
    if (normalizeVaultNameForCompare(existingRaw) === candidateCase) {
      return { existing: existingRaw, kind: 'case' }
    }
    if (normalizeVaultNameForCompare(sanitizeVaultDirectoryName(existingRaw)) === candidateDir) {
      return { existing: existingRaw, kind: 'directory' }
    }
  }
  return null
}

export function validateVaultName(name: string): VaultNameValidationResult {
  const normalized = normalizeVaultNameInput(name)
  if (!normalized) return { ok: false, reason: 'empty' }
  if (normalized === '.' || normalized === '..') return { ok: false, reason: 'invalid_chars' }
  if (INVALID_VAULT_NAME_REGEX.test(normalized)) {
    return { ok: false, reason: 'invalid_chars' }
  }
  return { ok: true, name: normalized }
}

/**
 * Vault 在磁盘上的目录名（与 validateVaultName 独立，兼容历史非法名称）。
 * 桌面与移动端 getVaultDirectory 均应使用此函数。
 */
export function sanitizeVaultDirectoryName(vaultName: string): string {
  const sanitized = vaultName.replace(/[\\/:%#?*\x00-\x1f]/g, '_').trim()
  return sanitized || 'vault'
}

/** 用于影子索引等路径片段，避免 % 等字符导致 file:// URI 解析失败 */
export function sanitizeVaultNameForPathSegment(name: string): string {
  return sanitizeVaultDirectoryName(name)
}

/** Vault 在磁盘上的目录名（与 validateVaultName 独立，兼容历史非法名称） */
export function vaultDirectoryBasename(vaultName: string): string {
  return sanitizeVaultDirectoryName(vaultName)
}

export function isValidVaultName(name: string): boolean {
  return validateVaultName(name).ok
}
