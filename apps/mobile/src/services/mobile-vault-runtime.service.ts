import {
  DiaryService,
  VaultService,
  type IFileSystem,
  type IStoragePathService,
  SessionManagerService,
  AssistantManagerService,
  SettingsManagerService,
  SummarySyncService
} from '@baishou/core-mobile'
import {
  shadowConnectionManager,
  ShadowIndexRepository,
  ShadowIndexUpsertOps
} from '@baishou/database'
import { logger } from '@baishou/shared'
import type { ToolDiaryMutationResult } from '@baishou/ai'
import { mobileDataBootstrapper, type MobileBootstrapperDeps } from './mobile-bootstrapper.service'
import { unbindShadowVaultScanState } from './mobile-shadow-scan-state.service'
import { waitForVaultEcosystemResync } from './mobile-vault-resync.service'
import { vaultFileWatcher } from './vault-file-watcher.service'
import { sessionFileWatcher } from './session-file-watcher.service'
import { summaryFileWatcher } from './summary-file-watcher.service'
import { ExternalStorageRequiredError } from './storage-required.error'
import type { DiaryRepository } from '@baishou/database'
import { createVaultBoundDiaryStack } from './mobile-vault-diary-stack.helpers'
import {
  buildBootstrapDeps,
  preferActiveVaultWithJournalsOnDisk,
  runVaultBootstrap
} from './mobile-vault-bootstrap.helpers'
import { restartVaultWatchers, type VaultRuntimeWatcherDeps } from './mobile-vault-watcher.helpers'
import { bumpVaultRuntimeGeneration } from './mobile-vault-runtime-state.helpers'
import type { MobileExternalPathService } from './mobile-external-vault-paths.service'

import type {
  VaultDiarySearcher,
  VaultBoundDiaryStack,
  VaultSwitchCallbacks,
  ActivateVaultRuntimeOptions,
  StorageRootRebootstrapOptions
} from './mobile-vault-runtime.types'
export type {
  VaultDiarySearcher,
  VaultBoundDiaryStack,
  VaultSwitchCallbacks,
  ActivateVaultRuntimeOptions,
  StorageRootRebootstrapOptions
} from './mobile-vault-runtime.types'
export type { VaultRuntimeWatcherDeps } from './mobile-vault-watcher.helpers'

export const EMPTY_DIARY_REPO_ADAPTER: Pick<DiaryRepository, 'list' | 'findByDateRange'> = {
  list: async () => [],
  findByDateRange: async () => []
}

/** 无外部存储时占位 DiaryService（只读返回空，写入抛错） */
export function createUnavailableDiaryService(): DiaryService {
  const emptyList = async () => [] as Awaited<ReturnType<DiaryService['listFiltered']>>
  const emptyCount = async () => 0
  const emptyNull = async () => null
  const requireStorage = async () => {
    throw new ExternalStorageRequiredError()
  }
  return {
    listAll: emptyList,
    listFiltered: emptyList,
    count: emptyCount,
    countFiltered: emptyCount,
    search: emptyList,
    searchPage: async () => ({ items: [], hasMore: false }),
    countSearch: emptyCount,
    findById: emptyNull,
    findByDate: emptyNull,
    findMetaByIds: emptyList,
    create: requireStorage,
    update: requireStorage,
    delete: requireStorage
  } as unknown as DiaryService
}

const diaryMutationUnavailable = async (): Promise<ToolDiaryMutationResult> => ({
  ok: false,
  message: 'Error: Diary storage is not available. Please configure external storage first.'
})

export const EMPTY_DIARY_SEARCHER: VaultDiarySearcher = {
  searchFTS: async () => [],
  listInDateRange: async () => [],
  readByDates: async (dates) => dates.map((date) => ({ date, content: null })),
  writeEntry: diaryMutationUnavailable,
  editEntry: diaryMutationUnavailable,
  deleteEntry: diaryMutationUnavailable
}

/** 始终委托到 diaryStackRef.current，避免 Vault 切换后仍访问已关闭的 Shadow DB */
export function createVaultDiaryServiceProxy(stackRef: {
  current: VaultBoundDiaryStack | null
}): DiaryService {
  const unavailable = createUnavailableDiaryService()
  return new Proxy(unavailable, {
    get(_target, prop) {
      const active = stackRef.current?.diaryService ?? unavailable
      const value = Reflect.get(active as object, prop, active)
      if (typeof value === 'function') {
        return (...args: unknown[]) => (value as (...a: unknown[]) => unknown).apply(active, args)
      }
      return value
    }
  }) as DiaryService
}

export async function initVaultLayer(deps: {
  pathService: IStoragePathService
  vaultService: VaultService
  fileSystem: IFileSystem
  settingsManager?: SettingsManagerService
}): Promise<VaultBoundDiaryStack> {
  await deps.pathService.getRootDirectory()
  await deps.vaultService.initRegistry()
  await connectGlobalShadowDb(deps)
  return createVaultBoundDiaryStack(deps)
}

export async function connectGlobalShadowDb(deps: {
  pathService: IStoragePathService
  fileSystem: IFileSystem
}): Promise<void> {
  if (shadowConnectionManager.isConnected()) {
    return
  }

  if (connectGlobalShadowDbInFlight) {
    await connectGlobalShadowDbInFlight
    return
  }

  const task = (async () => {
    if (shadowConnectionManager.isConnected()) {
      return
    }
    const sysDir = await deps.pathService.getGlobalShadowIndexDirectory()
    await deps.fileSystem.mkdir(sysDir, { recursive: true })
    await shadowConnectionManager.connect(sysDir)
    logger.info(`[VaultRuntime] 全局 Shadow DB 已连接: ${sysDir}`)
  })()

  connectGlobalShadowDbInFlight = task
  try {
    await task
  } finally {
    if (connectGlobalShadowDbInFlight === task) {
      connectGlobalShadowDbInFlight = null
    }
  }
}

let connectGlobalShadowDbInFlight: Promise<void> | null = null

export async function stopVaultWatchers(): Promise<void> {
  await vaultFileWatcher.waitUntilIdle()
  await sessionFileWatcher.waitUntilIdle()
  await summaryFileWatcher.waitUntilIdle()
  vaultFileWatcher.stop()
  sessionFileWatcher.stop()
  summaryFileWatcher.stop()
}

export async function prepareVaultSwitch(
  currentStack?: VaultBoundDiaryStack,
  options?: { sessionManager?: SessionManagerService }
): Promise<void> {
  // 停 watcher / 切 vault 前先落盘，避免「库有盘无」被后续 fullResync 当幽灵删掉
  if (options?.sessionManager) {
    try {
      await options.sessionManager.flushPendingDiskWrites()
    } catch (e) {
      logger.warn('[VaultRuntime] flushPendingDiskWrites before switch failed:', e as Error)
    }
  }
  if (currentStack) {
    currentStack.shadowIndexSyncService.setSyncEnabled(false)
  }
  unbindShadowVaultScanState()
  await stopVaultWatchers()
  if (currentStack) {
    await currentStack.shadowIndexSyncService.waitForScan()
  }
  await ShadowIndexUpsertOps.waitForIdle()
  await mobileDataBootstrapper.waitUntilIdle()
  // deferResync 的 onComplete 可能在 waitUntilIdle 期间重启 watcher，切换继续前再停一次
  await stopVaultWatchers()
}

/** 文件级迁移/复制前：停 watcher、刷盘、断开 Shadow DB（不退出应用） */
export async function quiesceStorageForFileCopy(deps: {
  currentStack?: VaultBoundDiaryStack
  settingsManager: SettingsManagerService
  sessionManager?: SessionManagerService
}): Promise<void> {
  bumpVaultRuntimeGeneration()
  await prepareVaultSwitch(deps.currentStack, { sessionManager: deps.sessionManager })
  await deps.settingsManager.flushToDisk()
  if (deps.sessionManager) {
    try {
      await deps.sessionManager.flushPendingDiskWrites()
    } catch (e) {
      logger.warn('[VaultRuntime] flushPendingDiskWrites during quiesce failed:', e as Error)
    }
  }
  await shadowConnectionManager.disconnect()
}

export async function resumeStorageAfterFileCopy(deps: {
  pathService: IStoragePathService
  vaultService: VaultService
  fileSystem: IFileSystem
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
}): Promise<VaultBoundDiaryStack> {
  await connectGlobalShadowDb(deps)
  const diaryStack = createVaultBoundDiaryStack({
    pathService: deps.pathService,
    vaultService: deps.vaultService,
    fileSystem: deps.fileSystem,
    settingsManager: deps.bootstrapDeps.settingsManager
  })
  // 根路径未变，仅恢复 watcher / Shadow 连接，避免迁移后立刻全量重扫导致闪退
  await runVaultBootstrap({ ...deps, diaryStack }, { skipFullResync: true })
  return diaryStack
}

type VaultBootstrapBaseDeps = Omit<
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

/**
 * 文件级迁移/复制后阻塞重建 Shadow 索引。
 * resumeStorageAfterFileCopy 会 skipFullResync 并提前启动 watcher；watcher 仅扫 Journals 顶层且
 * 首次见到的文件不入库，嵌套日记只能靠 fullScanVault。此处先停 watcher 再阻塞全量扫描。
 */
export async function resyncEcosystemAfterFileMutation(deps: {
  diaryStack: VaultBoundDiaryStack
  vaultService: VaultService
  bootstrapDeps: VaultBootstrapBaseDeps
  watcherDeps: VaultRuntimeWatcherDeps
}): Promise<void> {
  await waitForVaultEcosystemResync()
  await mobileDataBootstrapper.waitUntilIdle()
  await stopVaultWatchers()
  await deps.diaryStack.shadowIndexSyncService.waitForScan()

  const bootstrapDeps = buildBootstrapDeps(deps.diaryStack, deps.bootstrapDeps)
  deps.diaryStack.shadowIndexSyncService.setSyncEnabled(true)

  logger.info('[VaultRuntime] Blocking ecosystem resync after file mutation…')
  await mobileDataBootstrapper.runWhenVaultReady(bootstrapDeps, { force: true })
  await restartVaultWatchers(deps.diaryStack, deps.vaultService, deps.watcherDeps)
  logger.info('[VaultRuntime] Post-mutation ecosystem resync complete')
}

let storageRootRebootstrapInFlight: Promise<VaultBoundDiaryStack> | null = null

/** 数据根目录变更后：重载 registry、重建 diary stack 并全量扫描日记 */
export async function rebootstrapAfterStorageRootChange(
  deps: {
    pathService: IStoragePathService
    vaultService: VaultService
    fileSystem: IFileSystem
    diaryStack?: VaultBoundDiaryStack
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
  options?: StorageRootRebootstrapOptions
): Promise<VaultBoundDiaryStack> {
  if (storageRootRebootstrapInFlight) {
    return storageRootRebootstrapInFlight
  }

  const blockingResync = options?.blockingResync ?? false

  const task = (async () => {
    bumpVaultRuntimeGeneration()
    await prepareVaultSwitch(deps.diaryStack, {
      sessionManager: deps.bootstrapDeps.sessionManager
    })
    await deps.vaultService.initRegistry()
    if (blockingResync) {
      await preferActiveVaultWithJournalsOnDisk({
        vaultService: deps.vaultService,
        fileSystem: deps.fileSystem,
        pathService: deps.pathService as unknown as MobileExternalPathService
      })
    }
    await connectGlobalShadowDb(deps)
    if (blockingResync) {
      await clearAllVaultShadowIndexes(deps.vaultService)
    }

    const diaryStack = createVaultBoundDiaryStack({
      pathService: deps.pathService,
      vaultService: deps.vaultService,
      fileSystem: deps.fileSystem,
      settingsManager: deps.bootstrapDeps.settingsManager
    })
    await runVaultBootstrap(
      {
        pathService: deps.pathService,
        vaultService: deps.vaultService,
        fileSystem: deps.fileSystem,
        diaryStack,
        bootstrapDeps: deps.bootstrapDeps,
        watcherDeps: deps.watcherDeps
      },
      {
        deferResync: !blockingResync,
        resyncReason: blockingResync ? 'archive-full-restore' : 'storage-root-changed'
      }
    )
    logger.info(
      blockingResync
        ? '[VaultRuntime] Storage root rebootstrap complete (blocking resync)'
        : '[VaultRuntime] Storage root rebootstrap scheduled (background resync)'
    )
    return diaryStack
  })()

  storageRootRebootstrapInFlight = task
  try {
    return await task
  } finally {
    if (storageRootRebootstrapInFlight === task) {
      storageRootRebootstrapInFlight = null
    }
  }
}

/** 归档恢复 / summary 管线重建后，刷新 bootstrapper 与总结文件 watcher 的绑定 */
export function registerVaultBootstrapDeps(
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
  const deps = buildBootstrapDeps(diaryStack, bootstrapDeps)
  mobileDataBootstrapper.registerDeps(deps)
  summaryFileWatcher.stop()
  summaryFileWatcher.start(deps.summarySyncService)
  return deps
}

export async function activateVaultRuntime(
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
  options?: ActivateVaultRuntimeOptions
): Promise<void> {
  await runVaultBootstrap(deps, {
    deferResync: options?.deferResync ?? true,
    forceDeferResync: options?.forceDeferResync,
    forceShadowResync: options?.forceShadowResync,
    resyncReason: options?.resyncReason ?? 'cold-start',
    onResyncComplete: options?.onResyncComplete
  })
}

let vaultSwitchInFlight: Promise<VaultBoundDiaryStack> | null = null

export async function switchVaultRuntime(
  vaultName: string,
  deps: {
    pathService: IStoragePathService
    vaultService: VaultService
    fileSystem: IFileSystem
    bootstrapDeps: Omit<MobileBootstrapperDeps, 'shadowIndexSyncService'>
    watcherDeps: VaultRuntimeWatcherDeps
    currentStack?: VaultBoundDiaryStack
    callbacks?: VaultSwitchCallbacks
  }
): Promise<VaultBoundDiaryStack> {
  if (vaultSwitchInFlight) {
    try {
      await vaultSwitchInFlight
    } catch {
      // 上一次切换失败，允许继续
    }
  }

  const switchTask = (async () => {
    bumpVaultRuntimeGeneration()
    await prepareVaultSwitch(deps.currentStack, {
      sessionManager: deps.bootstrapDeps.sessionManager
    })

    const active = deps.vaultService.getActiveVault()
    if (active?.name === vaultName && deps.currentStack) {
      await restartVaultWatchers(deps.currentStack, deps.vaultService, deps.watcherDeps)
      return deps.currentStack
    }

    await deps.vaultService.switchVault(vaultName)

    const { resetMobileRawDataRuntime, ensureMobileRawDataRuntime } =
      await import('./mobile-raw-data-source.runtime')
    resetMobileRawDataRuntime()
    ensureMobileRawDataRuntime({
      pathService: deps.pathService,
      fileSystem: deps.fileSystem
    })

    deps.callbacks?.onStackInvalidated?.()

    const diaryStack = createVaultBoundDiaryStack({
      pathService: deps.pathService,
      vaultService: deps.vaultService,
      fileSystem: deps.fileSystem,
      settingsManager: deps.bootstrapDeps.settingsManager
    })
    deps.callbacks?.onStackReady?.(diaryStack)

    await runVaultBootstrap(
      {
        pathService: deps.pathService,
        vaultService: deps.vaultService,
        fileSystem: deps.fileSystem,
        diaryStack,
        bootstrapDeps: deps.bootstrapDeps,
        watcherDeps: deps.watcherDeps
      },
      {
        deferResync: true,
        resyncReason: `vault-switch:${vaultName}`,
        onResyncComplete: deps.callbacks?.onResyncComplete
      }
    )

    return diaryStack
  })()

  vaultSwitchInFlight = switchTask
  try {
    return await switchTask
  } finally {
    if (vaultSwitchInFlight === switchTask) {
      vaultSwitchInFlight = null
    }
  }
}

/** 删除工作空间前清理其在全局 Shadow DB 中的索引 */
export async function deleteVaultWithShadowCleanup(
  vaultName: string,
  deps: { vaultService: VaultService }
): Promise<void> {
  if (shadowConnectionManager.isConnected()) {
    const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultName)
    await shadowRepo.deleteAllForVault(vaultName)
  }
  await deps.vaultService.deleteVault(vaultName)
}

/** 全量归档恢复前清空 Shadow 索引，避免旧索引与全新磁盘内容不一致 */
export async function clearAllVaultShadowIndexes(vaultService: VaultService): Promise<void> {
  if (!shadowConnectionManager.isConnected()) return
  const db = shadowConnectionManager.getDb()
  for (const vault of vaultService.getAllVaults()) {
    const shadowRepo = new ShadowIndexRepository(db, vault.name)
    await shadowRepo.deleteAllForVault(vault.name)
  }
  logger.info('[VaultRuntime] Cleared shadow index for all vaults before archive restore resync')
}
