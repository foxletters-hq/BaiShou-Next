import {
  VaultService,
  journalMarkdownExistsInTree,
  countJournalMarkdownInTree,
  countSummaryMarkdownInArchivesTree,
  probeJournalShadowResyncNeeded,
  path,
  type IFileSystem,
  type IStoragePathService,
  type SessionManagerService,
  type AssistantManagerService,
  type SettingsManagerService,
  type SummarySyncService
} from '@baishou/core-mobile'
import { logger } from '@baishou/shared'
import { mobileDataBootstrapper, type MobileBootstrapperDeps } from './mobile-bootstrapper.service'
import { scheduleVaultEcosystemResync } from './mobile-vault-resync.service'
import type { MobileExternalPathService } from './mobile-external-vault-paths.service'
import type { VaultBoundDiaryStack } from './mobile-vault-runtime.types'
import {
  isVaultRuntimeGenerationCurrent,
  getVaultRuntimeGeneration
} from './mobile-vault-runtime-state.helpers'
import { restartVaultWatchers, type VaultRuntimeWatcherDeps } from './mobile-vault-watcher.helpers'

export function buildBootstrapDeps(
  diaryStack: VaultBoundDiaryStack,
  bootstrapDeps: Omit<
    MobileBootstrapperDeps,
    | 'shadowIndexSyncService'
    | 'sessionManager'
    | 'assistantManager'
    | 'settingsManager'
    | 'summarySyncService'
  > & {
    sessionManager: SessionManagerService
    assistantManager: AssistantManagerService
    settingsManager: SettingsManagerService
    summarySyncService: SummarySyncService
  }
): MobileBootstrapperDeps {
  return {
    shadowIndexSyncService: diaryStack.shadowIndexSyncService,
    sessionManager: bootstrapDeps.sessionManager,
    assistantManager: bootstrapDeps.assistantManager,
    settingsManager: bootstrapDeps.settingsManager,
    summarySyncService: bootstrapDeps.summarySyncService,
    getActiveVaultName: bootstrapDeps.getActiveVaultName,
    getDiskVaultNames: bootstrapDeps.getDiskVaultNames
  }
}
async function shouldDeferVaultResync(
  deps: {
    diaryStack: VaultBoundDiaryStack
    vaultService: VaultService
    fileSystem: IFileSystem
    pathService: IStoragePathService
  },
  requested?: boolean,
  forceDefer?: boolean,
  resyncReason?: string
): Promise<boolean> {
  if (forceDefer) return true

  const defer = requested ?? true
  if (!defer) return false

  try {
    const records = await deps.diaryStack.shadowRepo.getAllRecords()
    if (records.length > 0) return true

    const active = deps.vaultService.getActiveVault()
    if (!active?.path) return true

    const journalsDir = await deps.pathService.getJournalsBaseDirectory()
    const hasOnDisk = await journalMarkdownExistsInTree(deps.fileSystem, journalsDir)
    if (hasOnDisk) {
      if (resyncReason === 'archive-full-restore') {
        logger.info(
          '[VaultRuntime] Shadow index empty but journal files exist on disk; running blocking resync'
        )
        return false
      }
      logger.info(
        '[VaultRuntime] Shadow index empty but journal files exist on disk; scheduling background resync'
      )
      return true
    }
  } catch (e) {
    logger.warn('[VaultRuntime] Failed to probe on-disk journals for resync mode:', e as Error)
  }

  return true
}

/** 归档恢复后：若当前活跃工作区磁盘数据偏少，切换到日记+总结总量最多的工作区 */
async function countArchiveMarkdownInTree(
  fileSystem: IFileSystem,
  vaultPath: string
): Promise<number> {
  let count = 0
  for (const root of ['Archives', 'Summaries']) {
    const baseDir = path.join(vaultPath, root)
    if (!(await fileSystem.exists(baseDir))) continue
    for (const typeDir of ['Weekly', 'Monthly', 'Quarterly', 'Yearly']) {
      const dir = path.join(baseDir, typeDir)
      if (!(await fileSystem.exists(dir))) continue
      const entries = await fileSystem.readdir(dir)
      count += entries.filter((name) => name.endsWith('.md')).length
    }
  }
  return count
}

export async function preferActiveVaultWithJournalsOnDisk(deps: {
  vaultService: VaultService
  fileSystem: IFileSystem
  pathService: MobileExternalPathService
}): Promise<void> {
  const vaults = deps.vaultService.getAllVaults()
  if (vaults.length === 0) return

  const scored: Array<{ name: string; score: number; journals: number; archives: number }> = []
  for (const vault of vaults) {
    const externalJournals = await deps.pathService.getExternalJournalsDirectory(vault.name)
    const externalSummaries = await deps.pathService.getExternalSummariesDirectory(vault.name)
    const journalsDir = externalJournals ?? path.join(vault.path, 'Journals')
    const journalCount = await countJournalMarkdownInTree(deps.fileSystem, journalsDir)

    let archiveCount = 0
    if (externalSummaries) {
      archiveCount = await countSummaryMarkdownInArchivesTree(deps.fileSystem, externalSummaries)
    } else {
      archiveCount = await countArchiveMarkdownInTree(deps.fileSystem, vault.path)
    }

    scored.push({
      name: vault.name,
      score: journalCount + archiveCount,
      journals: journalCount,
      archives: archiveCount
    })
  }

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score === 0) return

  const active = deps.vaultService.getActiveVault()
  const activeScore = active ? (scored.find((item) => item.name === active.name)?.score ?? 0) : 0

  if (active && activeScore >= best.score) return

  logger.info(
    `[VaultRuntime] Switching active vault to "${best.name}" (${best.journals} journals, ${best.archives} summaries on disk; previous score ${activeScore})`
  )
  await deps.vaultService.switchVault(best.name)
}
export async function runVaultBootstrap(
  deps: {
    pathService: IStoragePathService
    vaultService: VaultService
    fileSystem: IFileSystem
    diaryStack: VaultBoundDiaryStack
    bootstrapDeps: Omit<
      MobileBootstrapperDeps,
      | 'shadowIndexSyncService'
      | 'sessionManager'
      | 'assistantManager'
      | 'settingsManager'
      | 'summarySyncService'
    > & {
      sessionManager: SessionManagerService
      assistantManager: AssistantManagerService
      settingsManager: SettingsManagerService
      summarySyncService: SummarySyncService
    }
    watcherDeps: VaultRuntimeWatcherDeps
  },
  options?: {
    deferResync?: boolean
    /** 跳过上架日记存在时的阻塞全量扫描（旧版迁移完成后使用，避免 OOM 闪退） */
    forceDeferResync?: boolean
    /** 应用升级等场景强制全量影子 resync，忽略「索引已有记录」快路径 */
    forceShadowResync?: boolean
    skipFullResync?: boolean
    resyncReason?: string
    onResyncComplete?: () => void
  }
): Promise<void> {
  const bootstrapDeps = buildBootstrapDeps(deps.diaryStack, deps.bootstrapDeps)
  mobileDataBootstrapper.registerDeps(bootstrapDeps)
  deps.diaryStack.shadowIndexSyncService.setSyncEnabled(true)

  if (options?.skipFullResync) {
    await restartVaultWatchers(deps.diaryStack, deps.vaultService, deps.watcherDeps)
    return
  }

  if (!options?.forceDeferResync) {
    try {
      const activeVault = deps.vaultService.getActiveVault()
      const shadowCount = await deps.diaryStack.shadowRepo.count()
      const journalsDir = activeVault?.path
        ? path.join(activeVault.path, 'Journals')
        : await deps.pathService.getJournalsBaseDirectory()
      const probe = await probeJournalShadowResyncNeeded(
        deps.fileSystem,
        journalsDir,
        shadowCount,
        { forceResync: options?.forceShadowResync }
      )

      if (!probe.needsResync) {
        logger.info(
          `[VaultRuntime] Shadow index aligned with disk (${probe.shadowCount} entries); skipping shadow resync`
        )
        const activeVaultName = deps.vaultService.getActiveVault()?.name
        if (activeVaultName) {
          await deps.bootstrapDeps.summarySyncService
            .fullScanArchives({ activeVaultName })
            .catch((e) => {
              logger.warn(
                '[VaultRuntime] summary fullScanArchives after skip-shadow-resync failed:',
                e as Error
              )
            })
        }
        await restartVaultWatchers(deps.diaryStack, deps.vaultService, deps.watcherDeps)
        options?.onResyncComplete?.()
        return
      }

      logger.info(
        `[VaultRuntime] Shadow resync required (${probe.reason ?? 'unknown'}); disk=${probe.diskCount}, shadow=${probe.shadowCount}`
      )
    } catch (e) {
      logger.warn('[VaultRuntime] Failed to probe shadow index before resync:', e as Error)
    }
  }

  const deferResync = await shouldDeferVaultResync(
    deps,
    options?.deferResync,
    options?.forceDeferResync,
    options?.resyncReason
  )

  if (deferResync) {
    // 后台 resync 完成后再启动 watcher，避免 fullScanVault 与 VaultFileWatcher 并发写 Shadow DB
    const generation = getVaultRuntimeGeneration()
    void scheduleVaultEcosystemResync(
      bootstrapDeps,
      options?.resyncReason ?? 'vault-switch',
      () => {
        if (!isVaultRuntimeGenerationCurrent(generation)) {
          logger.info('[VaultRuntime] Skip stale watcher restart after background resync')
          return
        }
        void restartVaultWatchers(deps.diaryStack, deps.vaultService, deps.watcherDeps).finally(
          () => options?.onResyncComplete?.()
        )
      }
    )
    return
  }

  await mobileDataBootstrapper.runWhenVaultReady(bootstrapDeps, { force: true })
  await restartVaultWatchers(deps.diaryStack, deps.vaultService, deps.watcherDeps)
  options?.onResyncComplete?.()
}
