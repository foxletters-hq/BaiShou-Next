import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import {
  listDiskVaultFolderNames,
  createNodeFileSystem,
  S3NotConfiguredError
} from '@baishou/core-desktop'
import {
  collectManifestVaultScopes,
  evaluateIncrementalSyncPlanDrift,
  readVaultRegistryFingerprint,
  collectSyncedAgentAvatarBasenames,
  classifyIncrementalSyncPaths,
  type IncrementalSyncPlanReuseBaseline,
  type IncrementalSyncRunOptions,
  type SyncProgressEvent,
  logger
} from '@baishou/shared'
import { pathService, vaultService, notifyVaultRegistryUpdated } from './vault.ipc'
import { getOrchestrator, getSyncService } from './incremental-sync-service.factory'

/** 记忆或人生图文件有下载/删本地时，必须灌派生索引（与日记层索引独立） */
export function incrementalSyncShouldHydrateDerivedIndex(cls: {
  memory: boolean
  graph: boolean
}): boolean {
  return Boolean(cls.memory || cls.graph)
}

export function incrementalSyncNeedsBootstrap(result: {
  downloaded: string[]
  deletedLocal: string[]
  uploaded?: string[]
  deletedRemote?: string[]
  conflicted?: string[]
}): boolean {
  // 仅下载/删本地才需要灌索引；纯 upload 不碰本地索引树
  return result.downloaded.length > 0 || result.deletedLocal.length > 0
}

/** 同步完成后将磁盘 JSON/设置 水合进 SQLite，并通知渲染进程刷新（对齐移动端 afterSyncComplete） */
export async function afterIncrementalSync(
  result: {
    downloaded: string[]
    deletedLocal: string[]
    uploaded?: string[]
    deletedRemote?: string[]
    conflicted?: string[]
  },
  options?: { force?: boolean }
): Promise<void> {
  // delete-local / delete-remote 后若全局 AgentAvatars 残留，bootstrap mirror
  // 会再灌回当前 vault → 下次又变成上传或删云端
  const purgedAvatars = collectSyncedAgentAvatarBasenames([
    ...result.deletedLocal,
    ...(result.deletedRemote ?? [])
  ])
  if (purgedAvatars.length > 0) {
    await pathService.purgeAgentAvatarBasenames(purgedAvatars)
  }

  const cls = classifyIncrementalSyncPaths([...result.downloaded, ...result.deletedLocal])
  logger.warn('[IncrementalSync][PostSync] start', {
    downloaded: result.downloaded.length,
    deletedLocal: result.deletedLocal.length,
    uploaded: result.uploaded?.length ?? 0,
    classify: {
      journals: cls.journals,
      sessions: cls.sessions,
      summaries: cls.summaries,
      settings: cls.settings,
      assistants: cls.assistants,
      memory: cls.memory,
      graph: cls.graph,
      notebooks: cls.notebooks,
      sessionRefCount: cls.sessionRefs.length
    }
  })

  try {
    const { getAgentManagers } = await import('./agent-helpers')
    const { sessionManager } = getAgentManagers()
    const syncRoot = await pathService.getRootDirectory()
    const diskVaultNames = await listDiskVaultFolderNames(createNodeFileSystem(), syncRoot)
    const activeVaultName = vaultService.getActiveVault()?.name ?? null

    if (cls.sessions || cls.sessionRefs.length > 0) {
      const hydrate = await sessionManager.hydrateSessionsFromDiskIfNeeded({
        activeVaultName,
        diskVaultNames
      })
      if (
        cls.sessionRefs.length > 0 &&
        typeof sessionManager.importSessionsFromDisk === 'function'
      ) {
        await sessionManager.importSessionsFromDisk(cls.sessionRefs)
      }
      if (hydrate.hydrated || cls.sessionRefs.length > 0) {
        const { BrowserWindow } = await import('electron')
        BrowserWindow.getAllWindows().forEach((w) => {
          w.webContents.send('session:file-changed')
        })
      }
    }
  } catch (e) {
    logger.warn('[IncrementalSync] session hydrate after sync failed:', e as Error)
  }

  if (!options?.force && !incrementalSyncNeedsBootstrap(result)) {
    logger.warn('[IncrementalSync][PostSync] skip-index', { reason: 'upload-or-noop' })
    return
  }

  if (!incrementalSyncNeedsBootstrap(result)) {
    logger.warn('[IncrementalSync][PostSync] skip-index', { reason: 'upload-or-noop-forced' })
    return
  }

  const needsLayerIndex =
    cls.journals ||
    cls.summaries ||
    cls.settings ||
    cls.assistants ||
    (cls.sessions && result.deletedLocal.some((p) => /\/Sessions\//i.test(p)))

  if (needsLayerIndex) {
    const { globalBootstrapper } = await import('../services/bootstrapper.service')
    await globalBootstrapper.selectiveResyncAfterIncrementalSync({
      journals: cls.journals || result.deletedLocal.some((p) => /Journals|Diary/i.test(p)),
      summaries: cls.summaries,
      assistants: cls.assistants,
      settings: cls.settings,
      sessions: cls.sessions && result.deletedLocal.some((p) => /\/Sessions\//i.test(p)),
      skipEnsures: true
    })
  }

  // 日记同批下载时 selectiveResync 也会灌一次，但仍要带上 deletedShardPaths，
  // 否则同批 Graph/Memory 删除不会清 SQLite 派生索引。
  if (incrementalSyncShouldHydrateDerivedIndex(cls)) {
    const { runDerivedIndexHydration } = await import('../services/raw-data-source.runtime')
    await runDerivedIndexHydration('incremental-sync-memory-graph', {
      deletedShardPaths: result.deletedLocal
    })
  } else if (
    !needsLayerIndex &&
    !cls.notebooks &&
    cls.notebookGraphIds.length === 0
  ) {
    logger.warn('[IncrementalSync][PostSync] done-lite', { reason: 'sessions-hydrated-only' })
    return
  }

  if (cls.notebooks) {
    const { runKnowledgeHydrationAfterSync, runNotebookGraphIndexAfterSync } =
      await import('../services/raw-data-source.runtime')
    await runKnowledgeHydrationAfterSync('incremental-sync-notebooks')
    if (cls.notebookGraphIds.length > 0) {
      await runNotebookGraphIndexAfterSync(cls.notebookGraphIds, {
        deletedShardPaths: result.deletedLocal
      })
    }
  } else if (cls.notebookGraphIds.length > 0) {
    const { runNotebookGraphIndexAfterSync } = await import('../services/raw-data-source.runtime')
    await runNotebookGraphIndexAfterSync(cls.notebookGraphIds, {
      deletedShardPaths: result.deletedLocal
    })
  }

  const { invalidatePendingEmbedCountsCache } =
    await import('../services/pending-embed-counts.service')
  invalidatePendingEmbedCountsCache()
  const { BrowserWindow } = await import('electron')
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('diary:sync-event', { type: 'embed-pending-changed' })
    }
  }
  logger.warn('[IncrementalSync][PostSync] done')
}

/** 远端 tombstone / removed 中的伙伴头像：清掉本地复活副本后再扫描，避免反复「删本地」 */
export async function reconcileAgentAvatarsBeforeScan(
  remoteRemovedPaths: Iterable<string>
): Promise<void> {
  const basenames = collectSyncedAgentAvatarBasenames(remoteRemovedPaths)
  if (basenames.length > 0) {
    await pathService.purgeAgentAvatarBasenames(basenames)
  }
  await pathService.mirrorGlobalAgentAvatarsIntoVaults({ excludeBasenames: basenames })
}

async function resolveSyncPlanContext() {
  const syncRoot = await pathService.getRootDirectory()
  const registeredVaults = vaultService.getAllVaults().map((vault) => vault.name)
  const diskVaultNames = await listDiskVaultFolderNames(createNodeFileSystem(), syncRoot)
  const activeVault = vaultService.getActiveVault()
  return {
    registeredVaults,
    diskVaultNames,
    activeVaultName: activeVault?.name ?? null
  }
}

/** 仅在用户确认执行同步后调用：补登记磁盘/远端工作区 */
export async function ensureVaultsForIncrementalSync(
  runOptions?: IncrementalSyncRunOptions
): Promise<string[]> {
  const autoRegistered = [...(await vaultService.syncRegistryWithDisk())]
  const unknown = (runOptions?.unknownVaultPaths ?? []).filter(
    (name) => name !== '__root__' && name !== '__unknown__'
  )
  if (unknown.length > 0) {
    autoRegistered.push(...(await vaultService.ensureVaultsRegistered(unknown)))
  }
  const unique = [...new Set(autoRegistered)]
  if (unique.length > 0) {
    notifyVaultRegistryUpdated()
  }
  return unique
}

export async function flushPendingAgentSessionsBeforeSync(
  mode: 'full' | 'pending-only' = 'full'
): Promise<void> {
  try {
    const { getAgentManagers } = await import('./agent-helpers')
    const { sessionManager } = getAgentManagers()
    const activeVaultName = vaultService.getActiveVault()?.name ?? null
    const syncRoot = await pathService.getRootDirectory()
    const diskVaultNames = await listDiskVaultFolderNames(createNodeFileSystem(), syncRoot)
    logger.warn('[IncrementalSync][SessionFlush] desktop-prepare-start', {
      activeVaultName,
      diskVaultNames,
      mode
    })
    const result = await sessionManager.ensureSessionsFlushedToDisk({
      activeVaultName,
      diskVaultNames,
      mode
    })
    logger.warn('[IncrementalSync][SessionFlush] desktop-prepare-done', {
      activeVaultName: result.activeVaultName,
      flushed: result.flushed,
      pendingFlushed: result.pendingFlushed,
      skippedMissingScan: result.skippedMissingScan,
      dbTotalCount: result.dbTotalCount,
      dbCount: result.dbCount,
      diskCount: result.diskCount,
      missingCount: result.missingIds.length,
      failedCount: result.failedIds.length,
      skippedOtherVaultCount: result.skippedOtherVaultCount,
      missingIdSamples: result.missingIds.slice(0, 12),
      failedIdSamples: result.failedIds.slice(0, 12)
    })

    // 规划路径不做会话水合（慢且易触发二次确认）；同步结束后再补缺库会话
  } catch (e) {
    logger.warn('[IncrementalSync] session flushPending before sync failed:', e as Error)
  }
}

export function registerIncrementalSyncPlanIPC(): void {
  ipcMain.handle('incrementalSync:planSync', async (_, runOptions) => {
    await flushPendingAgentSessionsBeforeSync('pending-only')
    const service = await getSyncService()
    const config = await service.getConfig()
    if (!config.enabled) {
      throw new S3NotConfiguredError()
    }

    service.clearPlanManifestCache()
    await vaultService.syncRegistryWithDisk()
    const remoteManifest = await service.getRemoteManifest()
    await reconcileAgentAvatarsBeforeScan(Object.keys(remoteManifest.removed ?? {}))
    let context = await resolveSyncPlanContext()

    const localManifest = await service.buildLocalManifest()
    service.setPlanManifestCache(localManifest, remoteManifest)
    const manifestScopes = collectManifestVaultScopes(localManifest, remoteManifest)
    const pruned = await vaultService.pruneOrphanRegistryVaults(
      manifestScopes,
      context.diskVaultNames
    )
    if (pruned.length > 0) {
      notifyVaultRegistryUpdated()
      context = await resolveSyncPlanContext()
    }

    try {
      let preview = await service.planSync(context, runOptions as never)
      const unknown = preview.boundaryIssues.unknownVaultPaths.filter(
        (name) => name !== '__root__' && name !== '__unknown__'
      )
      if (unknown.length > 0) {
        await vaultService.ensureVaultsRegistered(unknown)
        notifyVaultRegistryUpdated()
        context = await resolveSyncPlanContext()
        service.clearPlanManifestCache()
        preview = await service.planSync(context, runOptions as never)
      }
      if (pruned.length > 0) {
        preview = { ...preview, prunedRegistryVaults: pruned }
      }
      return preview
    } finally {
      service.clearPreparedManifestCache()
    }
  })

  ipcMain.handle('incrementalSync:readVaultRegistryFingerprint', async () => {
    const root = await pathService.getRootDirectory()
    const nodeFs = createNodeFileSystem()
    const registryPath = path.join(root, 'vault_registry.json')
    return readVaultRegistryFingerprint(
      {
        exists: (p) => nodeFs.exists(p),
        stat: async (p) => {
          const stat = await fs.promises.stat(p)
          return { mtimeMs: stat.mtimeMs }
        },
        readFile: (p) => fs.promises.readFile(p, 'utf8')
      },
      registryPath
    )
  })

  ipcMain.handle(
    'incrementalSync:evaluatePlanDrift',
    async (_, baseline: IncrementalSyncPlanReuseBaseline) => {
      const service = await getSyncService()
      const local = await service.buildLocalManifest()
      const remote = await service.getRemoteManifest()
      return evaluateIncrementalSyncPlanDrift(baseline, local, remote)
    }
  )

  ipcMain.handle(
    'incrementalSync:orchestratedSync',
    async (event, runOptions?: IncrementalSyncRunOptions) => {
      const publishProgress = (progress: SyncProgressEvent) => {
        event.sender.send('incrementalSync:progress', progress)
      }
      publishProgress({
        phase: 'comparing',
        current: 0,
        total: 1,
        statusText: 'data_sync.progress_registering_vaults'
      })
      await flushPendingAgentSessionsBeforeSync('full')
      const autoRegisteredVaults = await ensureVaultsForIncrementalSync(runOptions)
      ;(await getSyncService()).clearPreparedManifestCache()
      const result = await (
        await getOrchestrator()
      ).sync((progress) => {
        publishProgress(progress)
      }, runOptions)
      await afterIncrementalSync(result)
      return { ...result, autoRegisteredVaults }
    }
  )
}
