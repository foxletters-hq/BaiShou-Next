import { describe, expect, it, vi } from 'vitest'
import { AgentDbRecoveryCoordinator } from '@baishou/database'

describe('AgentDbRecoveryCoordinator', () => {
  it('recovers once and retries via retryAfterRecovery factory', async () => {
    const coordinator = new AgentDbRecoveryCoordinator()
    const reload = vi.fn(async () => {})
    const afterReload = vi.fn(async () => {})
    coordinator.registerReload(reload)
    coordinator.registerAfterReload(afterReload)

    let attempts = 0
    const result = await coordinator.runWithRecovery(
      async () => {
        attempts += 1
        if (attempts === 1) {
          throw new Error('database disk image is malformed')
        }
        return 'stale-should-not-run'
      },
      'test-op',
      async () => {
        attempts += 1
        return 'ok'
      }
    )

    expect(result).toBe('ok')
    expect(reload).toHaveBeenCalledTimes(1)
    expect(afterReload).toHaveBeenCalledTimes(1)
    expect(attempts).toBe(2)
  })

  it('does not retry stale operation after recovery when no retry factory is provided', async () => {
    const coordinator = new AgentDbRecoveryCoordinator()
    coordinator.registerReload(vi.fn(async () => {}))
    coordinator.registerAfterReload(vi.fn(async () => {}))

    let attempts = 0
    await coordinator.runWithRecovery(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error('database disk image is malformed')
      }
    }, 'SessionSync.fullScanArchives')

    expect(attempts).toBe(1)
  })

  it('runBare skips nested recovery', async () => {
    const coordinator = new AgentDbRecoveryCoordinator()
    coordinator.registerReload(
      vi.fn(async () => {
        throw new Error('reload should not run inside runBare')
      })
    )

    await expect(
      coordinator.runBare(async () => {
        await coordinator.runWithRecovery(async () => {
          throw new Error('database disk image is malformed')
        }, 'nested')
      })
    ).rejects.toThrow('database disk image is malformed')
  })

  it('ignores non-corruption errors', async () => {
    const coordinator = new AgentDbRecoveryCoordinator()
    coordinator.registerReload(vi.fn(async () => {}))

    await expect(
      coordinator.runWithRecovery(async () => {
        throw new Error('malformed JSON')
      }, 'fts-backfill')
    ).rejects.toThrow('malformed JSON')
  })

  it('treats afterReload failure as recovery failure', async () => {
    const coordinator = new AgentDbRecoveryCoordinator()
    const onRecoverComplete = vi.fn()
    const onRecoverFailed = vi.fn()
    coordinator.setDiagnostics({ onRecoverComplete, onRecoverFailed })
    coordinator.registerReload(vi.fn(async () => {}))
    coordinator.registerAfterReload(async () => {
      throw new Error('resync failed')
    })

    await expect(
      coordinator.runWithRecovery(async () => {
        throw new Error('database disk image is malformed')
      }, 'test-op')
    ).rejects.toThrow('database disk image is malformed')

    expect(onRecoverComplete).not.toHaveBeenCalled()
    expect(onRecoverFailed).toHaveBeenCalledTimes(1)
  })
})
