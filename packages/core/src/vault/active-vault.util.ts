/** 衍生小窝命名特征，如 Personal45、Personal82 */
const DERIVATIVE_VAULT_NAME_PATTERN = /^Personal\d+$/i

function getVaultPriority(name?: string | null): number {
  if (!name || typeof name !== 'string') return 0
  const trimmed = name.trim()
  if (DERIVATIVE_VAULT_NAME_PATTERN.test(trimmed)) {
    return -10 // 衍生小窝降级，防止反客为主
  }
  if (trimmed.toLowerCase() === 'personal') {
    return 10 // 官方默认主小窝在无偏好时拥有最高兜底权重
  }
  return 0
}

/**
 * V2-D6：按本机 activeVaultId 解析活跃仓；找不到时按优先级和 lastAccessedAt 最大者回退。
 * lastAccessedAt 仅作展示排序 / 无偏好时的兜底，不作为跨设备共享的活跃真相。
 */
export function pickActiveVault<T extends { id: string; name?: string; lastAccessedAt: Date }>(
  vaults: readonly T[],
  preferredId: string | null | undefined
): T | null {
  if (vaults.length === 0) return null
  const trimmed = typeof preferredId === 'string' ? preferredId.trim() : ''
  if (trimmed) {
    const hit = vaults.find((v) => v.id === trimmed)
    if (hit) return hit
  }
  return (
    [...vaults].sort((a, b) => {
      const priorityDiff = getVaultPriority(b.name) - getVaultPriority(a.name)
      if (priorityDiff !== 0) return priorityDiff
      return b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime()
    })[0] || null
  )
}

/** 从注册表 JSON 条目解析活跃名（path service 冷路径用） */
export function pickActiveVaultNameFromRegistryEntries(
  vaults: ReadonlyArray<{ id?: string; name?: string; lastAccessedAt?: string | number | Date }>,
  preferredId: string | null | undefined
): string | null {
  if (!Array.isArray(vaults) || vaults.length === 0) return null
  const trimmed = typeof preferredId === 'string' ? preferredId.trim() : ''
  if (trimmed) {
    const hit = vaults.find((v) => typeof v.id === 'string' && v.id === trimmed && v.name)
    if (hit?.name) return hit.name
  }
  const sorted = [...vaults].sort((a, b) => {
    const priorityDiff = getVaultPriority(b.name) - getVaultPriority(a.name)
    if (priorityDiff !== 0) return priorityDiff
    const ta = a.lastAccessedAt != null ? new Date(a.lastAccessedAt).getTime() : 0
    const tb = b.lastAccessedAt != null ? new Date(b.lastAccessedAt).getTime() : 0
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
  })
  const top = sorted[0]
  return typeof top?.name === 'string' && top.name.trim() ? top.name : null
}
