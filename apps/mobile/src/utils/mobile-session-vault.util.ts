import {
  deriveLegacyVaultId,
  evaluateSessionVaultAccess,
  resolveSessionVaultCandidateIds
} from '@baishou/shared'

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

/** 计算当前活跃小窝查询会话列表时允许匹配的 vault_id 候选集，排除其他已注册小窝。 */
export function resolveMobileSessionVaultCandidateIds(
  services: Pick<MobileSessionVaultServices, 'vaultService'>
): string[] {
  return resolveSessionVaultCandidateIds({
    activeVault: services.vaultService?.getActiveVault?.(),
    allVaults: services.vaultService?.getAllVaults?.()
  })
}

/**
 * 当前仓库内的会话才放行。
 * 与 resolveMobileSessionVaultCandidateIds 共享同一隔离与历史自愈规则：
 * 明确归属系统中另一个已注册小窝的会话一律拦截；仅对当前小窝的历史/衍生 ID 执行自愈。
 */
export async function loadMobileSessionInActiveVault<
  TSession extends { vaultId?: string | null } = { vaultId?: string | null }
>(services: MobileSessionVaultServices<TSession>, sessionId: string): Promise<TSession | null> {
  const session = await services.sessionManager.getSessionById(sessionId)
  if (!session) return null

  const active = services.vaultService?.getActiveVault?.()
  const allVaults = services.vaultService?.getAllVaults?.() ?? []
  const stored = String(session.vaultId ?? '').trim()
  const evaluation = evaluateSessionVaultAccess(session.vaultId, {
    activeVault: active,
    allVaults
  })

  if (evaluation.decision === 'match') {
    return session
  }

  if (evaluation.decision === 'deny-other-vault') {
    console.warn('[loadMobileSessionInActiveVault] 会话不在活跃小窝中被拦截（确属其他小窝）:', {
      sessionId,
      storedVaultId: stored,
      activeVaultId: evaluation.activeVaultId,
      activeName: evaluation.activeVaultName
    })
    return null
  }

  if (evaluation.decision === 'deny-unknown') {
    console.warn('[loadMobileSessionInActiveVault] 会话不在活跃小窝中被拦截:', {
      sessionId,
      storedVaultId: stored,
      activeVaultId: evaluation.activeVaultId,
      candidateIds: evaluation.candidateIds
    })
    return null
  }

  console.log('[loadMobileSessionInActiveVault] 纠正会话 vault_id 为活跃小窝 ID:', {
    sessionId,
    from: stored || '(empty)',
    to: evaluation.activeVaultId
  })

  if (services.sessionRepo?.updateSessionVaultId) {
    await services.sessionRepo.updateSessionVaultId(sessionId, evaluation.activeVaultId)
    services.sessionManager.notifySessionMutated?.(sessionId)
  }
  return { ...session, vaultId: evaluation.activeVaultId }
}

export async function assertMobileSessionInActiveVault(
  services: MobileSessionVaultServices,
  sessionId: string
): Promise<boolean> {
  return (await loadMobileSessionInActiveVault(services, sessionId)) != null
}
