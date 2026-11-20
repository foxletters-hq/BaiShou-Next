import { deriveLegacyVaultId } from './vault-id.util'

export interface VaultScopeIdentity {
  id?: string | null
  name?: string | null
}

export interface ResolveSessionVaultCandidateIdsInput {
  activeVault?: VaultScopeIdentity | null
  allVaults?: ReadonlyArray<VaultScopeIdentity> | null
}

export interface SessionVaultAccessEvaluation {
  decision: 'match' | 'self-heal' | 'deny-other-vault' | 'deny-unknown'
  activeVaultId: string
  activeVaultName: string
  candidateIds: string[]
}

const PERSONAL_DERIVATIVE_NAME_RE = /^Personal(\d+)?$/i

function resolveVaultScopeContext(input: ResolveSessionVaultCandidateIdsInput) {
  const activeName = String(input.activeVault?.name ?? '').trim() || 'Personal'
  const explicitActiveId = String(input.activeVault?.id ?? '').trim()
  const activeVaultId = explicitActiveId || deriveLegacyVaultId(activeName)

  const otherVaults = (input.allVaults ?? []).filter((vault) => {
    const vid = String(vault?.id ?? '').trim()
    const vname = String(vault?.name ?? '').trim()
    if (!vid && !vname) return false
    if (explicitActiveId && vid) {
      return vid !== explicitActiveId
    }
    return vid !== activeVaultId && vname !== activeName
  })

  const otherVaultReservedIds = new Set<string>()
  for (const other of otherVaults) {
    const otherId = String(other?.id ?? '').trim()
    const otherName = String(other?.name ?? '').trim()
    if (otherId) otherVaultReservedIds.add(otherId)
    if (otherName) {
      otherVaultReservedIds.add(otherName)
      otherVaultReservedIds.add(deriveLegacyVaultId(otherName))
    }
  }

  const candidateIds: string[] = [activeVaultId]
  const nameDerived = deriveLegacyVaultId(activeName)
  if (
    nameDerived &&
    !candidateIds.includes(nameDerived) &&
    !otherVaultReservedIds.has(nameDerived)
  ) {
    candidateIds.push(nameDerived)
  }

  const defaultPersonalDerived = deriveLegacyVaultId('Personal')
  const allowLegacyPersonalFallback =
    !otherVaultReservedIds.has(defaultPersonalDerived) &&
    (PERSONAL_DERIVATIVE_NAME_RE.test(activeName) || otherVaults.length === 0)
  if (
    allowLegacyPersonalFallback &&
    defaultPersonalDerived &&
    !candidateIds.includes(defaultPersonalDerived)
  ) {
    candidateIds.push(defaultPersonalDerived)
  }

  return {
    activeVaultId,
    activeVaultName: activeName,
    otherVaultReservedIds,
    candidateIds
  }
}

/**
 * 计算当前活跃小窝查询会话列表时允许匹配的 vault_id 候选集：
 * - 始终包含活跃小窝真实 ID；
 * - 在不与其他已注册小窝冲突时，兼容当前小窝名称派生的历史 ID；
 * - 仅当不存在占用 Personal 的其他小窝，且当前为单小窝或 Personal 衍生小窝时，
 *   才兼容历史默认 Personal 派生 ID，避免多小窝切换时串入 Personal 的会话。
 */
export function resolveSessionVaultCandidateIds(
  input: ResolveSessionVaultCandidateIdsInput
): string[] {
  return resolveVaultScopeContext(input).candidateIds
}

/**
 * 评估单个会话是否允许在当前活跃小窝中被访问或自愈，与 resolveSessionVaultCandidateIds 保持同构。
 */
export function evaluateSessionVaultAccess(
  sessionVaultId: string | null | undefined,
  input: ResolveSessionVaultCandidateIdsInput
): SessionVaultAccessEvaluation {
  const { activeVaultId, activeVaultName, otherVaultReservedIds, candidateIds } =
    resolveVaultScopeContext(input)
  const stored = String(sessionVaultId ?? '').trim()

  if (sessionBelongsToActiveVaultId(stored, activeVaultId)) {
    return { decision: 'match', activeVaultId, activeVaultName, candidateIds }
  }

  if (stored && otherVaultReservedIds.has(stored)) {
    return { decision: 'deny-other-vault', activeVaultId, activeVaultName, candidateIds }
  }

  const canSelfHeal =
    !stored || stored === 'default' || stored === activeVaultName || candidateIds.includes(stored)

  return {
    decision: canSelfHeal ? 'self-heal' : 'deny-unknown',
    activeVaultId,
    activeVaultName,
    candidateIds
  }
}

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

/**
 * 会话 IDOR 防护：按稳定 vault_id 比对。
 * 缺任一侧 → fail-closed（拒绝访问）。
 */
export function sessionBelongsToActiveVaultId(
  sessionVaultId: string | null | undefined,
  activeVaultId: string | null | undefined
): boolean {
  const sessionId = String(sessionVaultId ?? '').trim()
  const activeId = String(activeVaultId ?? '').trim()
  if (!sessionId || !activeId) return false
  return sessionId === activeId
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
