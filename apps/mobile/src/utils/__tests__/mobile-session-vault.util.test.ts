import { describe, expect, it, vi } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
import {
  loadMobileSessionInActiveVault,
  resolveMobileActiveVaultId
} from '../mobile-session-vault.util'

function servicesWith(
  active: { id?: string; name?: string } | null,
  session: { vaultId?: string | null } | null
) {
  return {
    sessionManager: {
      getSessionById: vi.fn().mockResolvedValue(session),
      notifySessionMutated: vi.fn()
    },
    sessionRepo: {
      updateSessionVaultId: vi.fn().mockResolvedValue(undefined)
    },
    vaultService: {
      getActiveVault: () => active
    }
  }
}

describe('resolveMobileActiveVaultId', () => {
  it('should prefer the live vault id over a name-derived id', () => {
    expect(
      resolveMobileActiveVaultId({
        vaultService: { getActiveVault: () => ({ id: 'vlt_live', name: 'Personal' }) }
      })
    ).toBe('vlt_live')
  })

  it('should fall back to a name-derived id when the live vault has no id', () => {
    expect(
      resolveMobileActiveVaultId({
        vaultService: { getActiveVault: () => ({ name: 'Work' }) }
      })
    ).toBe(deriveLegacyVaultId('Work'))
  })
})

describe('loadMobileSessionInActiveVault', () => {
  it('should allow a session that already belongs to the live vault', async () => {
    const services = servicesWith({ id: 'vlt_live', name: 'Personal' }, { vaultId: 'vlt_live' })
    const session = await loadMobileSessionInActiveVault(services, 'sess_1')
    expect(session?.vaultId).toBe('vlt_live')
    expect(services.sessionRepo.updateSessionVaultId).not.toHaveBeenCalled()
  })

  it('should rewrite a name-derived vault id to the live vault id', async () => {
    const services = servicesWith(
      { id: 'vlt_live', name: 'Personal' },
      { vaultId: deriveLegacyVaultId('Personal') }
    )
    const session = await loadMobileSessionInActiveVault(services, 'sess_1')
    expect(session?.vaultId).toBe('vlt_live')
    expect(services.sessionRepo.updateSessionVaultId).toHaveBeenCalledWith('sess_1', 'vlt_live')
    expect(services.sessionManager.notifySessionMutated).toHaveBeenCalledWith('sess_1')
  })

  it('should self-heal a legacy Personal session in a Personal-derivative vault (e.g. Personal45)', async () => {
    const services = servicesWith(
      { id: 'vlt_52f1ae2cda9f36e5', name: 'Personal45' },
      { vaultId: deriveLegacyVaultId('Personal') }
    )
    const session = await loadMobileSessionInActiveVault(services, '1793803995935')
    expect(session?.vaultId).toBe('vlt_52f1ae2cda9f36e5')
    expect(services.sessionRepo.updateSessionVaultId).toHaveBeenCalledWith(
      '1793803995935',
      'vlt_52f1ae2cda9f36e5'
    )
    expect(services.sessionManager.notifySessionMutated).toHaveBeenCalledWith('1793803995935')
  })

  it('should self-heal a session with empty or missing vaultId', async () => {
    const services = servicesWith({ id: 'vlt_live', name: 'Personal' }, { vaultId: null })
    const session = await loadMobileSessionInActiveVault(services, 'sess_legacy')
    expect(session?.vaultId).toBe('vlt_live')
    expect(services.sessionRepo.updateSessionVaultId).toHaveBeenCalledWith(
      'sess_legacy',
      'vlt_live'
    )
  })

  it('should deny a session that belongs to another registered vault when multi-vault is present', async () => {
    const services = {
      ...servicesWith(
        { id: 'vlt_live', name: 'Work' },
        { vaultId: deriveLegacyVaultId('Personal') }
      ),
      vaultService: {
        getActiveVault: () => ({ id: 'vlt_live', name: 'Work' }),
        getAllVaults: () => [
          { id: 'vlt_live', name: 'Work' },
          { id: 'vlt_personal', name: 'Personal' }
        ]
      }
    }
    await expect(loadMobileSessionInActiveVault(services, 'sess_1')).resolves.toBeNull()
    expect(services.sessionRepo.updateSessionVaultId).not.toHaveBeenCalled()
  })

  it('should deny a session that belongs to another vault', async () => {
    const services = servicesWith({ id: 'vlt_live', name: 'Personal' }, { vaultId: 'vlt_other' })
    await expect(loadMobileSessionInActiveVault(services, 'sess_1')).resolves.toBeNull()
    expect(services.sessionRepo.updateSessionVaultId).not.toHaveBeenCalled()
  })

  it('should deny a missing session', async () => {
    const services = servicesWith({ id: 'vlt_live', name: 'Personal' }, null)
    await expect(loadMobileSessionInActiveVault(services, 'missing')).resolves.toBeNull()
  })

  it('should still admit a name-derived session when vault rewrite is unavailable', async () => {
    const services = {
      sessionManager: {
        getSessionById: vi.fn().mockResolvedValue({ vaultId: deriveLegacyVaultId('Personal') }),
        notifySessionMutated: vi.fn()
      },
      vaultService: {
        getActiveVault: () => ({ id: 'vlt_live', name: 'Personal' })
      }
    }
    const session = await loadMobileSessionInActiveVault(services, 'sess_1')
    expect(session?.vaultId).toBe('vlt_live')
    expect(services.sessionManager.notifySessionMutated).not.toHaveBeenCalled()
  })
})
