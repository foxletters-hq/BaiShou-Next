/**
 * V2-D6：按本机 activeVaultId 解析活跃仓；找不到时回退 lastAccessedAt 最大者。
 * lastAccessedAt 仅作展示排序 / 无偏好时的兜底，不作为跨设备共享的活跃真相。
 */
export function pickActiveVault<T extends { id: string; lastAccessedAt: Date }>(
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
    [...vaults].sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime())[0] || null
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
    const ta = a.lastAccessedAt != null ? new Date(a.lastAccessedAt).getTime() : 0
    const tb = b.lastAccessedAt != null ? new Date(b.lastAccessedAt).getTime() : 0
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
  })
  const top = sorted[0]
  return typeof top?.name === 'string' && top.name.trim() ? top.name : null
}
