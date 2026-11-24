import { beforeEach, describe, expect, it, vi } from 'vitest'

const probeJournalShadowResyncNeeded = vi.fn()
const ensureDefaultLatteAssistant = vi.fn()
const restartVaultWatchers = vi.fn()
const notifyMobileSessionChanged = vi.fn()
const scheduleVaultEcosystemResync = vi.fn()
const runMobileDerivedIndexHydration = vi.fn()
const resolveMobileEmbeddingForHydration = vi.fn()

vi.mock('@baishou/core-mobile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@baishou/core-mobile')>()
  return {
    ...actual,
    probeJournalShadowResyncNeeded,
    ensureDefaultLatteAssistant
  }
})

vi.mock('../mobile-vault-watcher.helpers', () => ({
  restartVaultWatchers
}))

vi.mock('../mobile-session-events', () => ({
  notifyMobileSessionChanged
}))

vi.mock('../mobile-vault-resync.service', () => ({
  scheduleVaultEcosystemResync
}))

vi.mock('../mobile-raw-data-source.runtime', () => ({
  runMobileDerivedIndexHydration,
  resolveMobileEmbeddingForHydration
}))

vi.mock('../mobile-vault-auto-heal.service', () => ({
  autoHealMobileDerivativeVaults: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../mobile-agent-db-runtime-ref', () => ({
  agentDbRuntimeRef: { current: null }
}))

vi.mock('../../lib/onboarding-language.util', () => ({
  resolveMobileBootstrapUiLocale: vi.fn().mockResolvedValue(null)
}))

const { runVaultBootstrap } = await import('../mobile-vault-bootstrap.helpers')

describe('mobile-vault-bootstrap.helpers fast path session completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    probeJournalShadowResyncNeeded.mockResolvedValue({
      needsResync: false,
      shadowCount: 128,
      diskCount: 128
    })
    restartVaultWatchers.mockResolvedValue(undefined)
    resolveMobileEmbeddingForHydration.mockResolvedValue({
      embeddingProvider: null,
      embeddingModelId: null
    })
  })

  it('hydrates missing sessions in background even when shadow journal count matches disk', async () => {
    const hydrateSessionsFromDiskIfNeeded = vi.fn().mockResolvedValue({
      hydrated: true,
      reason: 'missing-ids',
      dbCount: 1569,
      diskCount: 1569,
      missingCount: 400
    })
    const onResyncComplete = vi.fn()

    await runVaultBootstrap(
      {
        pathService: {
          getJournalsBaseDirectory: vi.fn().mockResolvedValue('/root/Personal/Journals'),
          getRootDirectory: vi.fn().mockResolvedValue('/root')
        } as any,
        vaultService: {
          getActiveVault: () => ({ id: 'vlt_personal', name: 'Personal', path: '/root/Personal' }),
          getAllVaults: () => [{ id: 'vlt_personal', name: 'Personal', path: '/root/Personal' }]
        } as any,
        fileSystem: {} as any,
        diaryStack: {
          shadowRepo: { count: vi.fn().mockResolvedValue(128) },
          shadowIndexSyncService: { setSyncEnabled: vi.fn() }
        } as any,
        bootstrapDeps: {
          sessionManager: { hydrateSessionsFromDiskIfNeeded } as any,
          assistantManager: {} as any,
          settingsManager: { get: vi.fn().mockResolvedValue({}) } as any,
          summarySyncService: { fullScanArchives: vi.fn().mockResolvedValue(undefined) } as any,
          getDiskVaultNames: vi.fn().mockResolvedValue(['Personal', 'Work'])
        },
        watcherDeps: {} as any
      },
      { skipAutoHeal: true, onResyncComplete }
    )

    // 等待异步后台补齐微任务完成
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(hydrateSessionsFromDiskIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        activeVaultName: 'Personal',
        diskVaultNames: ['Personal', 'Work'],
        onSessionImported: expect.any(Function)
      })
    )
    expect(notifyMobileSessionChanged).toHaveBeenCalledWith('__bootstrap_hydrate__')
    expect(onResyncComplete).toHaveBeenCalledTimes(2)
  })
})
