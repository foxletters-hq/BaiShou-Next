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
  vaultService?: { getActiveVault?: () => { id?: string; name?: string } | null }
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
 * 若落库时误把「仓库名派生 id」写成 vault_id，而活跃仓已是随机 id，则回写后放行。
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

  const nameDerived = deriveLegacyVaultId(active?.name || 'Personal')
  const stored = String(session.vaultId ?? '').trim()
  if (!stored || stored !== nameDerived || stored === activeVaultId) {
    return null
  }

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
