import { deriveLegacyVaultId, sessionBelongsToActiveVaultId } from '@baishou/shared'

export type MobileSessionVaultServices<
  TSession extends { vaultId?: string | null } = { vaultId?: string | null }
> = {
  sessionManager: {
    getSessionById: (id: string) => Promise<TSession | null>
    notifySessionMutated?: (sessionId: string) => void
  }
  sessionRepo?: {
    updateSessionVaultId?: (sessionId: string, vaultId: string) => Promise<void>
  }
  vaultService?: {
    getActiveVault?: () => { id?: string; name?: string } | null
    getAllVaults?: () => Array<{ id?: string; name?: string }>
  }
}

/** 写入/校验会话归属：优先活跃仓库真实 id，不要把仓库名再哈希一遍。 */
export function resolveMobileActiveVaultId(
  services: Pick<MobileSessionVaultServices, 'vaultService'>
): string {
  const active = services.vaultService?.getActiveVault?.()
  const id = String(active?.id ?? '').trim()
  if (id) return id
  return deriveLegacyVaultId(active?.name || 'Personal')
}

/**
 * 当前仓库内的会话才放行。
 * 对齐会话列表查询候选：支持活跃仓真实 ID、名称派生 ID、历史 Personal 衍生 ID 以及单小窝存量会话自愈。
 * 只有当会话明确归属于系统中另一个不同的小窝时才拦截，避免旧会话或自动修复小窝产生假性无权访问。
 */
export async function loadMobileSessionInActiveVault<
  TSession extends { vaultId?: string | null } = { vaultId?: string | null }
>(services: MobileSessionVaultServices<TSession>, sessionId: string): Promise<TSession | null> {
  const session = await services.sessionManager.getSessionById(sessionId)
  if (!session) return null

  const active = services.vaultService?.getActiveVault?.()
  const activeVaultId = resolveMobileActiveVaultId(services)
  if (sessionBelongsToActiveVaultId(session.vaultId, activeVaultId)) {
    return session
  }

  const activeName = active?.name?.trim() || 'Personal'
  const nameDerived = deriveLegacyVaultId(activeName)
  const defaultPersonalDerived = deriveLegacyVaultId('Personal')
  const stored = String(session.vaultId ?? '').trim()

  const allVaults = services.vaultService?.getAllVaults?.() ?? []
  const otherVaults = allVaults.filter((v) => {
    const vid = String(v.id ?? '').trim()
    const vname = String(v.name ?? '').trim()
    return vid !== activeVaultId && vname !== activeName
  })

  // 1. 如果明确属于系统中另一个有效小窝（按真实 ID 或名称或旧派生 ID 匹配），拒绝越权访问
  const belongsToOtherVault =
    otherVaults.length > 0 &&
    Boolean(stored) &&
    otherVaults.some((other) => {
      const otherId = String(other.id ?? '').trim()
      const otherName = String(other.name ?? '').trim()
      if (otherId && stored === otherId) return true
      if (otherName && (stored === otherName || stored === deriveLegacyVaultId(otherName))) {
        return true
      }
      return false
    })

  if (belongsToOtherVault) {
    console.warn('[loadMobileSessionInActiveVault] 会话不在活跃小窝中被拦截（确属其他小窝）:', {
      sessionId,
      storedVaultId: stored,
      activeVaultId,
      activeName
    })
    return null
  }

  // 2. 检查是否满足当前小窝的合法历史/衍生自愈放行条件：
  // a) 历史遗留空值或 'default'
  // b) 会话存储 ID 等于当前活跃小窝名派生 ID
  // c) 会话存储 ID 等于当前活跃小窝名称
  // d) 会话存储 ID 为历史默认 Personal 派生 ID（且当前小窝为 Personal/衍生小窝，或系统中无其它 Personal 小窝）
  const isPersonalDerivative = /^Personal(\d+)?$/i.test(activeName)
  const isDefaultPersonalCandidate =
    stored === defaultPersonalDerived &&
    (isPersonalDerivative || !otherVaults.some((v) => v.name?.trim() === 'Personal'))

  const isAdmissibleCandidate =
    !stored ||
    stored === 'default' ||
    stored === nameDerived ||
    stored === activeName ||
    isDefaultPersonalCandidate

  if (!isAdmissibleCandidate) {
    console.warn('[loadMobileSessionInActiveVault] 会话不在活跃小窝中被拦截:', {
      sessionId,
      storedVaultId: stored,
      activeVaultId,
      nameDerived,
      defaultPersonalDerived
    })
    return null
  }

  console.log('[loadMobileSessionInActiveVault] 纠正会话 vault_id 为活跃小窝 ID:', {
    sessionId,
    from: stored || '(empty)',
    to: activeVaultId
  })

  if (services.sessionRepo?.updateSessionVaultId) {
    await services.sessionRepo.updateSessionVaultId(sessionId, activeVaultId)
    services.sessionManager.notifySessionMutated?.(sessionId)
  }
  return { ...session, vaultId: activeVaultId }
}

export async function assertMobileSessionInActiveVault(
  services: MobileSessionVaultServices,
  sessionId: string
): Promise<boolean> {
  return (await loadMobileSessionInActiveVault(services, sessionId)) != null
}
