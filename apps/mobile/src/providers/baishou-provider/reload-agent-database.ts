import i18n from 'i18next'
import {
  releaseExpoAgentDatabaseInstall,
  ensureExpoAgentDatabaseInstalled
} from '@baishou/database/expo'
import { createAgentDbRuntime } from '../../services/mobile-agent-db-runtime'
import {
  quarantineMobileAgentDatabase,
  mobileAgentDbRecovery
} from '../../services/mobile-agent-db-recovery.service'
import { attachMobileRagVaultScope } from '../../services/mobile-rag-vault-scope'
import { setMobileDiaryEmbeddingDeps } from '../../services/mobile-diary-embedding.service'
import { createMobileRagService } from '../../services/mobile-rag.service'
import { MobileIncrementalSyncService } from '../../services/mobile-incremental-sync.service'
import { MobileMcpService } from '../../services/mobile-mcp.service'
import {
  buildMobileMcpToolContext,
  buildMobileMcpToolListContext
} from '../../services/mobile-mcp-context.service'
import { MobileUpdaterService } from '../../services/mobile-updater.service'
import { emitSyncMutation } from '../../cache/mobile-cache-coordinator'
import { restartVaultWatchers } from '../../services/mobile-vault-watcher.helpers'
import {
  registerVaultBootstrapDeps,
  EMPTY_DIARY_REPO_ADAPTER,
  stopVaultWatchers
} from '../../services/mobile-vault-runtime.service'
import { resyncAgentDbCachesFromDisk } from '../../services/mobile-agent-db-resync.util'
import { MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES } from '../../services/mobile-file-read-limits'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import { mobileDataBootstrapper } from '../../services/mobile-bootstrapper.service'
import { webFetchContent, fetchSearchPageHtml } from './web-fetch'
import { logger } from '@baishou/shared'
import type { ToolDiarySearcher } from '@baishou/ai'
import type { MobileStoragePathService } from '../../services/path.service'
import type { VaultService } from '@baishou/core-mobile'
import type { MobileBaishouInitContext } from './init-context'
import type { ToolRegistry } from '@baishou/ai'
import type { MobileArchiveService } from '../../services/archive.service'

import type { Dispatch, SetStateAction } from 'react'
import type { BaishouContextValue } from './types'

export function assignReloadAgentDatabaseHandler(
  ctx: MobileBaishouInitContext,
  deps: {
    openAgentDatabase: (options?: {
      useNewConnection?: boolean
    }) => Promise<import('@baishou/database/expo').ExpoSqliteDatabase>
    vaultService: VaultService
    pathService: MobileStoragePathService
    toolRegistry: ToolRegistry
    archiveService: MobileArchiveService
    syncDeviceId: string
    getDiarySearcher: () => ToolDiarySearcher | undefined
    diaryServiceProxy: import('@baishou/core-mobile').DiaryService
    setValue: Dispatch<SetStateAction<BaishouContextValue>>
    mobileMcpServiceHolder: MobileBaishouInitContext['mobileMcpServiceHolder']
  }
): void {
  const { refs, isMounted, setValue, mobileMcpServiceHolder } = ctx
  let mobileMcpService = mobileMcpServiceHolder.current
  const {
    openAgentDatabase,
    vaultService,
    pathService,
    toolRegistry,
    archiveService,
    syncDeviceId,
    getDiarySearcher,
    diaryServiceProxy
  } = deps
  refs.reloadAgentDatabaseRef.current = async () => {
    const vaultCtx = refs.vaultBootstrapCtxRef.current
    if (!vaultCtx) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.providers.baishou.provider.reload.agent.database.L74',
          '数据库运行时未就绪，无法完成恢复'
        )
      )
    }

    const priorMcp = vaultCtx.mobileMcpService
    const mcpWasRunning = priorMcp?.isServerRunning() ?? false
    if (mcpWasRunning && priorMcp) {
      await priorMcp.stop()
    }

    // 先停 watcher，再隔离/重开 DB，避免 Session/Summary watcher 对已失效句柄狂刷 NPE
    await stopVaultWatchers()

    await releaseExpoAgentDatabaseInstall()
    await quarantineMobileAgentDatabase(vaultCtx.fileSystem)

    const { drizzleDb: newDrizzleDb, expoDb: newExpoDb } = await ensureExpoAgentDatabaseInstalled(
      (options) => openAgentDatabase({ ...options, useNewConnection: true })
    )

    const diaryRepoAdapter =
      refs.diaryStackRef.current?.diaryRepoAdapter ?? EMPTY_DIARY_REPO_ADAPTER

    const newRuntime = await createAgentDbRuntime({
      expoDb: newExpoDb,
      drizzleDb: newDrizzleDb,
      pathService: vaultCtx.pathService,
      fileSystem: vaultCtx.fileSystem,
      attachmentManager: vaultCtx.attachmentManager,
      diaryRepoAdapter
    })
    agentDbRuntimeRef.current = newRuntime

    if (refs.migrationRuntimeRef.current) {
      refs.migrationRuntimeRef.current = {
        ...refs.migrationRuntimeRef.current,
        expoDb: newExpoDb,
        settingsRepo: newRuntime.settingsRepo,
        profileRepo: newRuntime.profileRepo
      }
    }

    vaultCtx.bootstrapDeps.sessionManager = newRuntime.sessionManager
    vaultCtx.bootstrapDeps.assistantManager = newRuntime.assistantManager
    vaultCtx.bootstrapDeps.settingsManager = newRuntime.settingsManager
    vaultCtx.bootstrapDeps.summarySyncService = newRuntime.summarySyncService
    vaultCtx.watcherDeps.sessionManager = newRuntime.sessionManager
    vaultCtx.watcherDeps.sessionSyncService = newRuntime.sessionSyncService
    vaultCtx.watcherDeps.summarySyncService = newRuntime.summarySyncService

    const stack = refs.diaryStackRef.current
    if (stack) {
      registerVaultBootstrapDeps(stack, vaultCtx.bootstrapDeps)
      await restartVaultWatchers(stack, vaultService, vaultCtx.watcherDeps)
    }
    const nextRagDeps = attachMobileRagVaultScope(
      {
        settingsManager: newRuntime.settingsManager,
        diaryService: stack?.diaryService ?? diaryServiceProxy,
        hsRepo: newRuntime.hsRepo,
        hybridSearchService: newRuntime.hybridSearchService,
        registry: vaultCtx.registry,
        rawSqlClient: newRuntime.sqlExecutor
      },
      pathService,
      vaultService
    )
    setMobileDiaryEmbeddingDeps(nextRagDeps)
    vaultCtx.ragServiceRef.current = createMobileRagService(nextRagDeps)
    emitSyncMutation('resync-complete', 'agent-db-reload')

    mobileMcpServiceHolder.current = mobileMcpService = new MobileMcpService(
      newRuntime.settingsManager,
      toolRegistry,
      () => {
        const runtime = agentDbRuntimeRef.current
        return buildMobileMcpToolContext({
          settingsManager: runtime?.settingsManager ?? newRuntime.settingsManager,
          pathService: vaultCtx.pathService,
          getDiarySearcher,
          drizzleDb: runtime?.drizzleDb ?? newDrizzleDb,
          webSearchResultFetcher: webFetchContent,
          fetchSearchPage: fetchSearchPageHtml
        })
      },
      () =>
        buildMobileMcpToolListContext({
          settingsManager: newRuntime.settingsManager,
          pathService: vaultCtx.pathService
        })
    )
    vaultCtx.mobileMcpService = mobileMcpService
    if (mcpWasRunning) {
      await mobileMcpService.start().catch((mcpErr) => {
        logger.warn('[BaishouProvider] MCP restart after DB reload failed:', mcpErr as Error)
      })
    }

    const { getMobileRawDataSourceManager } = await import(
      '../../services/mobile-raw-data-source.runtime'
    )
    const nextIncrementalSyncService = new MobileIncrementalSyncService(
      newRuntime.settingsManager,
      archiveService,
      vaultCtx.pathService,
      vaultCtx.fileSystem,
      mobileDataBootstrapper,
      syncDeviceId,
      () => {
        if (!isMounted()) return
        setValue((prev) => ({
          ...prev,
          vaultRevision: prev.vaultRevision + 1
        }))
      },
      newRuntime.assistantManager,
      newRuntime.sessionManager,
      () => getMobileRawDataSourceManager()
    )

    if (isMounted()) {
      setValue((prev) => ({
        ...prev,
        services: prev.services
          ? {
              ...prev.services,
              sessionManager: newRuntime.sessionManager,
              sessionRepo: newRuntime.sessionRepo,
              snapshotRepo: newRuntime.snapshotRepo,
              assistantManager: newRuntime.assistantManager,
              settingsManager: newRuntime.settingsManager,
              summaryManager: newRuntime.summaryManager,
              summaryGenerator: newRuntime.summaryGenerator,
              missingSummaryDetector: newRuntime.missingSummaryDetector,
              ragService: vaultCtx.ragServiceRef.current,
              mobileMcpService: mobileMcpService!,
              incrementalSyncService: nextIncrementalSyncService,
              updaterService: new MobileUpdaterService(newRuntime.settingsManager)
            }
          : prev.services
      }))
    }
  }
  mobileAgentDbRecovery.registerReload(async () => {
    await refs.reloadAgentDatabaseRef.current()
  })
  mobileAgentDbRecovery.registerAfterReload(async () => {
    const vaultCtx = refs.vaultBootstrapCtxRef.current
    const runtime = agentDbRuntimeRef.current
    if (!vaultCtx || !runtime) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.providers.baishou.provider.reload.agent.database.L216',
          'Agent DB 运行时未就绪，无法从磁盘重同步'
        )
      )
    }
    const activeVaultName = vaultCtx.vaultService.getActiveVault()?.name
    await mobileAgentDbRecovery.runBare(async () => {
      const { listDiskVaultFolderNames } = await import('@baishou/core-mobile')
      const syncRoot = await vaultCtx.pathService.getRootDirectory()
      const diskVaultNames = await listDiskVaultFolderNames(vaultCtx.fileSystem, syncRoot)
      await resyncAgentDbCachesFromDisk({
        runtime,
        activeVaultName,
        diskVaultNames,
        maxSessionJsonReadBytes: MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES
      })
    })
  })
}
