import { InteractionManager } from 'react-native'
import { logger } from '@baishou/shared'
import { getTtsPlaybackSettings } from '../../services/mobile-tts-settings.service'
import { shouldRefreshVaultAfterArchiveImport } from '../../services/archive-guards.util'
import { emitSyncMutation } from '../../cache/mobile-cache-coordinator'
import { resyncEcosystemAfterFileMutation } from '../../services/mobile-vault-runtime.service'
import { markFlutterLegacyMigrationComplete } from '../../services/mobile-legacy-migration.service'
import { mobileDataBootstrapper } from '../../services/mobile-bootstrapper.service'
import { vaultFileWatcher } from '../../services/vault-file-watcher.service'
import { mobileDeveloperService } from '../../services/developer.service'
import type { ImportResult } from '@baishou/core-mobile'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import type { MobileBaishouInitContext } from './init-context'
import type { MobileBaishouCoreState } from './bootstrap-mobile-baishou-core'

export async function commitMobileBaishouReadyState(
  ctx: MobileBaishouInitContext,
  state: MobileBaishouCoreState
): Promise<void> {
  const { refs } = ctx
  const isMounted = ctx.isMounted
  const s = state as Record<string, any>
  const settingsManager = s.settingsManager
  const memorySearch = s.memorySearch
  const startAgentChat = s.startAgentChat
  const agentGate = s.agentGate
  const reloadAgentGateConfig = s.reloadAgentGateConfig
  const buildSharedContext = s.buildSharedContext
  const buildSharedContextPreview = s.buildSharedContextPreview
  const getContextAtMessage = s.getContextAtMessage
  const agentService = s.agentService
  const sessionManager = s.sessionManager
  const sessionRepo = s.sessionRepo
  const snapshotRepo = s.snapshotRepo
  const assistantManager = s.assistantManager
  const summaryManager = s.summaryManager
  const summaryGenerator = s.summaryGenerator
  const missingSummaryDetector = s.missingSummaryDetector
  const archiveService = s.archiveService
  const lanSyncService = s.lanSyncService
  const cloudSyncService = s.cloudSyncService
  const vaultService = s.vaultService
  const pathService = s.pathService
  const fileSystem = s.fileSystem
  const updaterService = s.updaterService
  const pricingService = s.pricingService
  const incrementalSyncService = s.incrementalSyncService
  const attachmentManager = s.attachmentManager
  const settingsRepo = s.settingsRepo
  const profileRepo = s.profileRepo
  const diaryServiceProxy = s.diaryServiceProxy
  const storageReady = s.storageReady
  const legacyRagReembedRequired = s.legacyRagReembedRequired
  const pendingFlutterLegacyMigration = s.pendingFlutterLegacyMigration
  const legacyMigrationSourcePendingDeletion = s.legacyMigrationSourcePendingDeletion
  const switchVault = s.switchVault
  const deleteVault = s.deleteVault
  const createDemoVault = s.createDemoVault
  const ragServiceRef = s.ragServiceRef
  const mobileMcpService = s.mobileMcpService
  const runDeferredVaultStartup = s.runDeferredVaultStartup as () => Promise<void>
  void getTtsPlaybackSettings(settingsManager).catch(() => {})

  if (isMounted()) {
    refs.notifyArchiveRestoreCompleteRef.current = (result: ImportResult) => {
      if (!isMounted() || !shouldRefreshVaultAfterArchiveImport(result)) return
      ctx.setValue((prev) => ({
        ...prev,
        vaultRevision: prev.vaultRevision + 1,
        archiveRestoreEpoch: prev.archiveRestoreEpoch + 1
      }))
    }

    refs.resyncAfterMigrationRef.current = async () => {
      const stack = refs.diaryStackRef.current
      const vaultCtx = refs.vaultBootstrapCtxRef.current
      if (!stack || !vaultCtx) return
      await resyncEcosystemAfterFileMutation({
        diaryStack: stack,
        vaultService: vaultCtx.vaultService,
        bootstrapDeps: vaultCtx.bootstrapDeps,
        watcherDeps: vaultCtx.watcherDeps
      })
      if (!isMounted()) return
      emitSyncMutation('resync-complete', 'ecosystem-resync')
      ctx.setValue((prev) => ({
        ...prev,
        ecosystemResyncEpoch: prev.ecosystemResyncEpoch + 1
      }))
    }

    refs.notifyVersionMigrationCompleteRef.current = () => {
      void (async () => {
        let markedComplete = false
        const runtime = refs.migrationRuntimeRef.current
        if (runtime) {
          try {
            const targetRoot = await runtime.pathService.getRootDirectory()
            await markFlutterLegacyMigrationComplete({
              installInstanceId: runtime.installInstanceId,
              targetRoot
            })
            markedComplete = true
          } catch (error) {
            logger.warn(
              '[BaishouProvider] markFlutterLegacyMigrationComplete failed:',
              error as Error
            )
          }
        }
        if (!isMounted()) return
        ctx.setValue((prev) => ({
          ...prev,
          vaultRevision: prev.vaultRevision + 1,
          ...(markedComplete ? { pendingFlutterLegacyMigration: null } : {})
        }))
      })()
    }

    ctx.setValue({
      dbReady: true,
      storageReady,
      legacyRagReembedRequired,
      pendingFlutterLegacyMigration,
      legacyMigrationSourcePendingDeletion,
      deleteMigratedLegacySource: () => refs.deleteMigratedLegacySourceRef.current(),
      vaultRevision: 0,
      notifyArchiveRestoreComplete: (result) =>
        refs.notifyArchiveRestoreCompleteRef.current(result),
      notifyVersionMigrationComplete: () => refs.notifyVersionMigrationCompleteRef.current(),
      archiveRestoreEpoch: 0,
      vaultSwitching: false,
      storageIndexing: mobileDataBootstrapper.getStatus() === 'running',
      ecosystemResyncEpoch: 0,
      retryStorageSetup: (options) => refs.retryStorageSetupRef.current(options),
      runWithStorageQuiesced: (fn) => refs.runWithStorageQuiescedRef.current(fn),
      resyncAfterMigration: () => refs.resyncAfterMigrationRef.current(),
      services: {
        agentService,
        sessionManager,
        sessionRepo,
        snapshotRepo,
        assistantManager,
        diaryService: diaryServiceProxy,
        settingsManager,
        summaryManager,
        summaryGenerator,
        missingSummaryDetector,
        archiveService,
        lanSyncService,
        cloudSyncService,
        vaultService,
        pathService,
        fileSystem,
        developerService: mobileDeveloperService,
        updaterService,
        pricingService,
        bootstrapper: mobileDataBootstrapper,
        vaultFileWatcher,
        switchVault,
        deleteVault,
        createDemoVault,
        memorySearch,
        mobileMcpService,
        ragService: ragServiceRef.current,
        incrementalSyncService,
        attachmentManager,
        expoDb: agentDbRuntimeRef.current?.expoDb ?? null,
        settingsRepo: agentDbRuntimeRef.current?.settingsRepo ?? settingsRepo,
        profileRepo: agentDbRuntimeRef.current?.profileRepo ?? profileRepo,
        buildSharedContext,
        buildSharedContextPreview,
        getContextAtMessage
      },
      startAgentChat,
      agentGate,
      reloadAgentGateConfig
    })
    InteractionManager.runAfterInteractions(() => {
      void runDeferredVaultStartup()
    })
  }
}
