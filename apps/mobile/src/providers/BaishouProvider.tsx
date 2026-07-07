import React, { useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import type { ImportResult } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'
import { setContextRecompressInvoker } from '@baishou/store'
import { agentDbRuntimeRef } from '../services/mobile-agent-db-runtime-ref'
import { mobileDataBootstrapper } from '../services/mobile-bootstrapper.service'
import { vaultFileWatcher } from '../services/vault-file-watcher.service'
import { MobileMcpService } from '../services/mobile-mcp.service'
import { recompressSessionContext } from '../services/mobile-context-recompress.service'
import { initMobileCacheCoordinator, emitSyncMutation } from '../cache/mobile-cache-coordinator'
import { sessionFileWatcher } from '../services/session-file-watcher.service'
import { summaryFileWatcher } from '../services/summary-file-watcher.service'
import {
  getShadowVaultScanning,
  subscribeShadowVaultScanning,
  unbindShadowVaultScanState
} from '../services/mobile-shadow-scan-state.service'
import type { VaultBoundDiaryStack } from '../services/mobile-vault-runtime.service'
import { BaishouContext, useBaishou } from './baishou-provider/context'
import type { BaishouContextValue, BaishouProviderProps } from './baishou-provider/types'
import { runMobileBaishouInit } from './baishou-provider/run-mobile-baishou-init'

export { useBaishou }
export type { BaishouContextValue } from './baishou-provider/types'

export function BaishouProvider({ children }: BaishouProviderProps) {
  const retryStorageSetupRef = useRef<
    (options?: { forceDeferResync?: boolean }) => Promise<boolean>
  >(async () => false)
  const runWithStorageQuiescedRef = useRef<<T>(fn: () => Promise<T>) => Promise<T>>(async (fn) =>
    fn()
  )
  const deleteMigratedLegacySourceRef = useRef<() => Promise<boolean>>(async () => false)
  const notifyArchiveRestoreCompleteRef = useRef<(result: ImportResult) => void>(() => {})
  const notifyVersionMigrationCompleteRef = useRef<() => void>(() => {})
  const resyncAfterMigrationRef = useRef<() => Promise<void>>(async () => {})
  const reloadAgentDatabaseRef = useRef<() => Promise<void>>(async () => {})
  const archiveFullRestoreDoneRef = useRef(false)
  const vaultBootstrapCtxRef =
    useRef<
      import('./baishou-provider/init-context').MobileBaishouInitRefs['vaultBootstrapCtxRef']['current']
    >(null)
  const migrationRuntimeRef =
    useRef<
      import('./baishou-provider/init-context').MobileBaishouInitRefs['migrationRuntimeRef']['current']
    >(null)
  const diaryStackRef = useRef<VaultBoundDiaryStack | null>(null)
  const mobileMcpServiceHolder = useRef<MobileMcpService | null>(null)

  const [value, setValue] = useState<BaishouContextValue>({
    dbReady: false,
    storageReady: Platform.OS !== 'android',
    legacyRagReembedRequired: false,
    pendingFlutterLegacyMigration: null,
    legacyMigrationSourcePendingDeletion: null,
    deleteMigratedLegacySource: () => deleteMigratedLegacySourceRef.current(),
    vaultRevision: 0,
    notifyArchiveRestoreComplete: (result) => notifyArchiveRestoreCompleteRef.current(result),
    notifyVersionMigrationComplete: () => notifyVersionMigrationCompleteRef.current(),
    archiveRestoreEpoch: 0,
    vaultSwitching: false,
    storageIndexing: mobileDataBootstrapper.getStatus() === 'running',
    ecosystemResyncEpoch: 0,
    retryStorageSetup: (options) => retryStorageSetupRef.current(options),
    runWithStorageQuiesced: (fn) => runWithStorageQuiescedRef.current(fn),
    resyncAfterMigration: () => resyncAfterMigrationRef.current(),
    services: null
  })

  useEffect(() => {
    const unsubscribeCacheCoordinator = initMobileCacheCoordinator()
    return unsubscribeCacheCoordinator
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'background' && nextState !== 'inactive') return
      const runtime = agentDbRuntimeRef.current
      if (!runtime) return
      void runtime.settingsManager.flushToDisk().catch((e) => {
        logger.warn('[BaishouProvider] settings flush on background failed:', e as Error)
      })
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    const mcpHolder = mobileMcpServiceHolder
    let isMounted = true
    let wasStorageIndexing =
      mobileDataBootstrapper.getStatus() === 'running' || getShadowVaultScanning()

    const publishStorageIndexing = () => {
      if (!isMounted) return
      const indexing = mobileDataBootstrapper.getStatus() === 'running' || getShadowVaultScanning()
      if (wasStorageIndexing && !indexing) {
        emitSyncMutation('resync-complete', 'storage-indexing-complete')
      }
      setValue((prev) => ({
        ...prev,
        storageIndexing: indexing,
        ecosystemResyncEpoch:
          wasStorageIndexing && !indexing
            ? prev.ecosystemResyncEpoch + 1
            : prev.ecosystemResyncEpoch
      }))
      wasStorageIndexing = indexing
    }

    const unsubscribeBootstrapper = mobileDataBootstrapper.subscribe(() => {
      publishStorageIndexing()
    })
    const unsubscribeShadowScan = subscribeShadowVaultScanning(() => {
      publishStorageIndexing()
    })

    void runMobileBaishouInit({
      isMounted: () => isMounted,
      setValue,
      refs: {
        retryStorageSetupRef,
        runWithStorageQuiescedRef,
        deleteMigratedLegacySourceRef,
        notifyArchiveRestoreCompleteRef,
        notifyVersionMigrationCompleteRef,
        resyncAfterMigrationRef,
        reloadAgentDatabaseRef,
        archiveFullRestoreDoneRef,
        vaultBootstrapCtxRef,
        migrationRuntimeRef,
        diaryStackRef
      },
      mobileMcpServiceHolder
    })

    return () => {
      isMounted = false
      unsubscribeBootstrapper()
      unsubscribeShadowScan()
      unbindShadowVaultScanState()
      vaultFileWatcher.stop()
      sessionFileWatcher.stop()
      summaryFileWatcher.stop()
      const mcpService = mcpHolder.current
      void mcpService?.stop()
    }
  }, [])

  useEffect(() => {
    setContextRecompressInvoker(async (sessionId) => {
      const runtime = agentDbRuntimeRef.current
      const ctx = vaultBootstrapCtxRef.current
      if (!runtime || !ctx) {
        return { ok: false, error: 'Database not ready' }
      }
      return recompressSessionContext(
        {
          sessionRepo: runtime.sessionRepo,
          snapshotRepo: runtime.snapshotRepo,
          settingsManager: runtime.settingsManager,
          registry: ctx.registry
        },
        sessionId
      )
    })
    return () => setContextRecompressInvoker(null)
  }, [])

  return <BaishouContext.Provider value={value}>{children}</BaishouContext.Provider>
}
