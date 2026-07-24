import i18n from 'i18next'
import {
  releaseExpoAgentDatabaseInstall,
  enterAgentMigrationArchiveImport,
  exitAgentMigrationArchiveImport,
  backfillExpoAgentMessagesFts
} from '@baishou/database/expo'
import { createSummaryPipelineServices } from '../../services/mobile-agent-db-runtime'
import type { SyncConfig } from '@baishou/core-mobile'
import { getAppDocumentDirectory } from '../../services/mobile-app-paths'
import { checkpointAgentDatabaseForExport } from '../../services/mobile-agent-db-checkpoint.util'
import { MOBILE_AGENT_DB_NAME } from '../../services/mobile-agent-db-recovery.service'
import { emitVaultSwitchMutation } from '../../cache/mobile-cache-coordinator'
import { attachMobileRagVaultScope } from '../../services/mobile-rag-vault-scope'
import { setMobileDiaryEmbeddingDeps } from '../../services/mobile-diary-embedding.service'
import { createMobileRagService } from '../../services/mobile-rag.service'
import { reconcileAssistantAvatarsAfterStorageChange } from '../../lib/assistant-avatar-reconcile.util'
import { reconcileUserAvatarProfileAfterStorageChange } from '../../lib/user-avatar-reconcile.util'
import {
  registerVaultBootstrapDeps,
  rebootstrapAfterStorageRootChange
} from '../../services/mobile-vault-runtime.service'
import { runMobileLegacyZipMigration } from '../../services/mobile-legacy-migration.service'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import { logger } from '@baishou/shared'
import type { MobileArchiveDbBridge } from '../../services/mobile-archive-db.bridge'
import type { MobileBaishouInitRefs } from './init-context'
import type { BaishouContextValue } from './types'
import type { Dispatch, SetStateAction } from 'react'
import type { IFileSystem, VaultService } from '@baishou/core-mobile'
import type { MobileStoragePathService } from '../../services/path.service'

export function createArchiveDbBridge(deps: {
  fileSystem: IFileSystem
  pathService: MobileStoragePathService
  vaultService: VaultService
  refs: MobileBaishouInitRefs
  isMounted: () => boolean
  setValue: Dispatch<SetStateAction<BaishouContextValue>>
}): MobileArchiveDbBridge {
  const { fileSystem, pathService, vaultService, refs, isMounted, setValue } = deps
  return {
    flushBeforeExport: async () => {
      const runtime = agentDbRuntimeRef.current
      if (!runtime) return
      await runtime.settingsManager.flushToDisk()
      try {
        await checkpointAgentDatabaseForExport((sql) => runtime.expoDb.execAsync(sql))
      } catch (checkpointError) {
        logger.error(
          '[MobileArchive] WAL checkpoint before export failed:',
          checkpointError as Error
        )
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.providers.baishou.provider.archive.db.bridge.L53',
            '数据库刷盘失败，已取消导出以保护备份完整性'
          )
        )
      }
    },
    runArchiveExportQuiesced: async (fn) => refs.runWithStorageQuiescedRef.current(fn),
    getMaxSnapshotCount: async () => {
      const runtime = agentDbRuntimeRef.current
      if (!runtime) return 5
      const config = await runtime.settingsManager.get<SyncConfig>('cloud_sync_config')
      return config?.maxSnapshotCount ?? 5
    },
    exportDevicePreferences: async () => {
      const runtime = agentDbRuntimeRef.current
      if (!runtime) return {}
      const prefs = await runtime.settingsRepo.getAll()
      const profile = await runtime.profileRepo.getProfile()
      return { ...prefs, user_profile_data: profile }
    },
    importDevicePreferences: async (prefs) => {
      const runtime = agentDbRuntimeRef.current
      if (!runtime) return
      for (const [key, value] of Object.entries(prefs)) {
        if (key === 'user_profile_data' || key === 'user_profile') continue
        if (value !== undefined && value !== null) {
          await runtime.settingsRepo.set(key, value as never)
        }
      }
      if (prefs.user_profile_data) {
        await runtime.profileRepo.saveProfile(prefs.user_profile_data as never)
      } else if (prefs.user_profile) {
        await runtime.profileRepo.saveProfile(prefs.user_profile as never)
      }
      await runtime.settingsManager.flushToDisk()
    },
    readPreservedImportSettings: async () => {
      const runtime = agentDbRuntimeRef.current
      if (!runtime) return {}
      return {
        cloud_sync_config: await runtime.settingsRepo.get('cloud_sync_config' as never)
      }
    },
    getAgentDatabaseUri: async () => `${getAppDocumentDirectory()}SQLite/${MOBILE_AGENT_DB_NAME}`,
    replaceAgentDatabaseFrom: async (sourceUri) => {
      await releaseExpoAgentDatabaseInstall()
      const sqliteDir = `${getAppDocumentDirectory()}SQLite/`
      const destBase = `${sqliteDir}${MOBILE_AGENT_DB_NAME}`
      for (const suffix of ['', '-wal', '-shm']) {
        const candidate = `${destBase}${suffix}`
        if (await fileSystem.exists(candidate)) {
          await fileSystem.unlink(candidate)
        }
      }
      await fileSystem.copyFile(sourceUri, destBase)
      await refs.reloadAgentDatabaseRef.current()
    },
    runArchiveImportQuiesced: async (fn) => {
      refs.archiveFullRestoreDoneRef.current = false
      enterAgentMigrationArchiveImport()
      try {
        return await refs.runWithStorageQuiescedRef.current(fn)
      } finally {
        exitAgentMigrationArchiveImport()
        refs.archiveFullRestoreDoneRef.current = false
      }
    },
    rebootstrapAfterArchiveRestore: async (options) => {
      const ctx = refs.vaultBootstrapCtxRef.current
      if (!ctx) return
      // 数据根已被覆盖，旧 diary stack 指向已删除路径，不可再用于 prepareVaultSwitch
      refs.diaryStackRef.current = null
      emitVaultSwitchMutation(undefined, 'archive-restore')
      const stack = await rebootstrapAfterStorageRootChange(
        {
          pathService: ctx.pathService,
          vaultService: ctx.vaultService,
          fileSystem: ctx.fileSystem,
          bootstrapDeps: ctx.bootstrapDeps,
          watcherDeps: ctx.watcherDeps
        },
        { blockingResync: options?.blockingResync ?? true }
      )
      refs.diaryStackRef.current = stack
      refs.archiveFullRestoreDoneRef.current = true
      const runtime = agentDbRuntimeRef.current
      if (!runtime) return
      await reconcileUserAvatarProfileAfterStorageChange(
        runtime.settingsManager,
        ctx.pathService,
        ctx.fileSystem
      )
      await reconcileAssistantAvatarsAfterStorageChange(
        runtime.assistantManager,
        ctx.pathService,
        ctx.fileSystem
      )

      const summaryPipeline = await createSummaryPipelineServices({
        drizzleDb: runtime.drizzleDb,
        pathService: ctx.pathService,
        fileSystem: ctx.fileSystem,
        settingsManager: runtime.settingsManager,
        diaryRepoAdapter: stack.diaryRepoAdapter
      })
      ctx.bootstrapDeps.summarySyncService = summaryPipeline.summarySyncService
      ctx.watcherDeps.summarySyncService = summaryPipeline.summarySyncService
      registerVaultBootstrapDeps(stack, ctx.bootstrapDeps)
      agentDbRuntimeRef.current = {
        ...runtime,
        summaryManager: summaryPipeline.summaryManager,
        summaryGenerator: summaryPipeline.summaryGenerator,
        missingSummaryDetector: summaryPipeline.missingSummaryDetector,
        summarySyncService: summaryPipeline.summarySyncService
      }
      if (options?.deferSummaryScan) {
        void summaryPipeline.summarySyncService.fullScanArchives().catch((e: unknown) => {
          logger.warn(
            '[BaishouProvider] deferred summary fullScanArchives after archive restore failed:',
            e as Error
          )
        })
      } else {
        try {
          await summaryPipeline.summarySyncService.fullScanArchives()
        } catch (e) {
          logger.warn(
            '[BaishouProvider] summary fullScanArchives after archive restore failed:',
            e as Error
          )
        }
      }

      void backfillExpoAgentMessagesFts(runtime.drizzleDb, runtime.expoDb).catch((e) => {
        logger.warn('[BaishouProvider] Agent FTS backfill after archive import failed:', e)
      })

      const nextRagDeps = attachMobileRagVaultScope(
        {
          settingsManager: runtime.settingsManager,
          diaryService: stack.diaryService,
          hsRepo: runtime.hsRepo,
          hybridSearchService: runtime.hybridSearchService,
          registry: ctx.registry,
          rawSqlClient: runtime.sqlExecutor
        },
        pathService,
        vaultService
      )
      setMobileDiaryEmbeddingDeps(nextRagDeps, { agentDb: runtime.drizzleDb })
      ctx.ragServiceRef.current = createMobileRagService(nextRagDeps)
      if (isMounted()) {
        setValue((prev) => ({
          ...prev,
          vaultRevision: prev.vaultRevision + 1,
          archiveRestoreEpoch: prev.archiveRestoreEpoch + 1,
          services: prev.services
            ? {
                ...prev.services,
                ragService: ctx.ragServiceRef.current,
                summaryManager: summaryPipeline.summaryManager,
                summaryGenerator: summaryPipeline.summaryGenerator,
                missingSummaryDetector: summaryPipeline.missingSummaryDetector
              }
            : prev.services
        }))
      }
    },
    importLegacyFlutterZip: async (extractDir, stagingRoot, options) => {
      const runtime = agentDbRuntimeRef.current
      if (!runtime) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.providers.baishou.provider.archive.db.bridge.L221',
            '数据库运行时未就绪，无法导入原版备份'
          )
        )
      }
      await runMobileLegacyZipMigration({
        fileSystem,
        extractDir,
        targetRoot: stagingRoot,
        settingsRepo: runtime.settingsRepo,
        profileRepo: runtime.profileRepo,
        onCopyProgress: options?.onCopyProgress
      })
      await runtime.settingsRepo.set('legacy_upgrade_rag_pending' as never, true as never)
    }
  }
}
