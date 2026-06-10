import {
  DiaryService,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl,
  VaultService,
  type IFileSystem,
  type IStoragePathService,
  SessionManagerService,
  AssistantManagerService,
  SettingsManagerService,
  SummarySyncService
} from '@baishou/core-mobile'
import {
  ShadowIndexRepository,
  shadowConnectionManager,
  ShadowIndexUpsertOps
} from '@baishou/database'
import {
  formatDiaryPreviewText,
  logger,
  parseDateStr,
  resolveDiaryAppendBlock,
  type DiaryTemplateConfig
} from '@baishou/shared'
import { mergeDiaryTags, type ToolDiaryMutationResult } from '@baishou/ai'

function diaryPreviewFromRaw(raw: string | null | undefined): string {
  const cleaned = formatDiaryPreviewText(raw)
  const firstLine = cleaned
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'))
  if (!firstLine) return '(empty)'
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine
}
import { mobileDataBootstrapper, type MobileBootstrapperDeps } from './mobile-bootstrapper.service'
import { scheduleVaultEcosystemResync } from './mobile-vault-resync.service'
import { vaultFileWatcher } from './vault-file-watcher.service'
import { sessionFileWatcher } from './session-file-watcher.service'
import { summaryFileWatcher } from './summary-file-watcher.service'
import { createShadowDiaryRepoAdapter } from './shadow-diary-adapter'
import { ExternalStorageRequiredError } from './storage-required.error'
import type { SessionFileService } from '@baishou/core-mobile'
import type { SessionSyncService } from '@baishou/core-mobile'
import type { DiaryRepository } from '@baishou/database'

export type VaultDiarySearcher = {
  searchFTS: (
    query: string,
    limit?: number
  ) => Promise<Array<{ date: string; contentSnippet: string; tags: string; rankScore: number }>>
  listInDateRange: (
    startDate: string,
    endDate: string
  ) => Promise<Array<{ date: string; preview: string }>>
  readByDates: (dates: string[]) => Promise<Array<{ date: string; content: string | null }>>
  writeEntry: (date: string, content: string, tags?: string) => Promise<ToolDiaryMutationResult>
  editEntry: (args: {
    date: string
    content: string
    mode: 'append' | 'overwrite'
    tags?: string
  }) => Promise<ToolDiaryMutationResult>
  deleteEntry: (date: string) => Promise<ToolDiaryMutationResult>
}

/** 随 Vault 切换需重建的日记/影子索引相关服务 */
export type VaultBoundDiaryStack = {
  shadowRepo: ShadowIndexRepository
  shadowIndexSyncService: ShadowIndexSyncService
  diaryService: DiaryService
  diaryRepoAdapter: ReturnType<typeof createShadowDiaryRepoAdapter>
  diarySearcher: VaultDiarySearcher
}

/** 无外部存储时 Summary 模块使用的空日记适配器 */
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
    countFiltered: emptyCount,
    search: emptyList,
    findById: emptyNull,
    findByDate: emptyNull,
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

export type VaultSwitchCallbacks = {
  /** Shadow DB disconnect 前调用，应清空 diaryStackRef */
  onStackInvalidated?: () => void
  /** 新 stack 就绪后立即调用 */
  onStackReady?: (stack: VaultBoundDiaryStack) => void
  /** 后台 resync 完成 */
  onResyncComplete?: () => void
}

export async function initVaultLayer(deps: {
  pathService: IStoragePathService
  vaultService: VaultService
  fileSystem: IFileSystem
  settingsManager?: SettingsManagerService
}): Promise<VaultBoundDiaryStack> {
  await deps.pathService.getRootDirectory()
  await deps.vaultService.initRegistry()
  await connectShadowForActiveVault(deps)
  return createVaultBoundDiaryStack(deps)
}

export function createVaultBoundDiaryStack(deps: {
  pathService: IStoragePathService
  vaultService: VaultService
  fileSystem: IFileSystem
  settingsManager?: SettingsManagerService
}): VaultBoundDiaryStack {
  const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb())
  const fileSyncService = new FileSyncServiceImpl(deps.pathService, deps.fileSystem)
  const vaultIndexService = new VaultIndexServiceImpl()
  const shadowIndexSyncService = new ShadowIndexSyncService(
    shadowRepo,
    deps.pathService,
    deps.vaultService,
    deps.fileSystem
  )
  const diaryService = new DiaryService(
    shadowRepo,
    fileSyncService,
    shadowIndexSyncService,
    vaultIndexService
  )
  const diaryRepoAdapter = createShadowDiaryRepoAdapter(shadowRepo)
  const diarySearcher: VaultDiarySearcher = {
    async searchFTS(query: string, limit?: number) {
      const results = await shadowRepo.searchFTS(query, limit)
      const allRecords = await shadowRepo.getAllRecords()
      const idToDateMap = new Map(allRecords.map((r) => [r.id, r.date]))
      return results.map((r) => ({
        date: idToDateMap.get(r.rowid) || '',
        contentSnippet: r.contentSnippet,
        tags: r.tags,
        rankScore: r.rankScore
      }))
    },
    async listInDateRange(startDate: string, endDate: string) {
      const rows = await shadowRepo.findByDateRange(startDate, endDate)
      return rows.map((row) => ({
        date: row.date,
        preview: diaryPreviewFromRaw((row as { rawContent?: string | null }).rawContent)
      }))
    },
    async readByDates(dates: string[]) {
      const rows: Array<{ date: string; content: string | null }> = []
      for (const date of dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          rows.push({ date, content: null })
          continue
        }
        const diary = await diaryService.findByDate(parseDateStr(date))
        rows.push({ date, content: diary?.content ?? null })
      }
      return rows
    },
    async writeEntry(date: string, content: string, tags?: string) {
      try {
        const tagsStr = tags
          ?.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .join(',')
        await diaryService.create({
          date: parseDateStr(date),
          content,
          ...(tagsStr ? { tags: tagsStr } : {})
        })
        return { ok: true as const }
      } catch (e) {
        if (e instanceof Error && e.name === 'DiaryDateConflictError') {
          return {
            ok: false as const,
            message: `Error: A diary entry for ${date} already exists. Use diary_edit to modify it.`
          }
        }
        return {
          ok: false as const,
          message: `Error: Failed to create diary entry: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    },
    async editEntry({ date, content, mode, tags }) {
      try {
        const existing = await diaryService.findByDate(parseDateStr(date))
        if (!existing?.id) {
          return {
            ok: false as const,
            message: `Error: Diary entry for ${date} does not exist. Use diary_write to create it instead.`
          }
        }

        let finalContent = content
        if (mode === 'append') {
          const templateConfig: DiaryTemplateConfig = deps.settingsManager
            ? (await deps.settingsManager.get<DiaryTemplateConfig>('diary_template_config')) || {}
            : {}
          const block = resolveDiaryAppendBlock(templateConfig, new Date()).replace(/\u200B$/, '')
          finalContent = existing.content.trimEnd() + block + content
        }

        await diaryService.update(existing.id, {
          content: finalContent,
          ...(tags ? { tags: mergeDiaryTags(existing.tags, tags) } : {})
        })
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          message: `Error: Failed to edit diary: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    },
    async deleteEntry(date: string) {
      try {
        const existing = await diaryService.findByDate(parseDateStr(date))
        if (!existing?.id) {
          return {
            ok: false as const,
            message: `Error: Could not find diary entry for ${date} to delete.`
          }
        }
        await diaryService.delete(existing.id)
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          message: `Error: Failed to delete diary: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    }
  }

  return {
    shadowRepo,
    shadowIndexSyncService,
    diaryService,
    diaryRepoAdapter,
    diarySearcher
  }
}

export async function connectShadowForActiveVault(deps: {
  pathService: IStoragePathService
  vaultService: VaultService
  fileSystem: IFileSystem
}): Promise<void> {
  const activeVault = deps.vaultService.getActiveVault()
  if (!activeVault) {
    logger.warn('[VaultRuntime] 无活跃 Vault，跳过 Shadow DB 连接')
    return
  }

  const sysDir = await deps.pathService.getShadowIndexDirectory(activeVault.name)
  await deps.fileSystem.mkdir(sysDir, { recursive: true })
  await shadowConnectionManager.connect(sysDir)
  logger.info(`[VaultRuntime] Shadow DB 已连接: ${activeVault.name}`)
}

export type VaultRuntimeWatcherDeps = {
  pathService: IStoragePathService
  fileSystem: IFileSystem
  sessionFileService: SessionFileService
  sessionSyncService: SessionSyncService
  sessionManager: SessionManagerService
  summarySyncService: SummarySyncService
}

export async function stopVaultWatchers(): Promise<void> {
  await vaultFileWatcher.waitUntilIdle()
  await sessionFileWatcher.waitUntilIdle()
  await summaryFileWatcher.waitUntilIdle()
  vaultFileWatcher.stop()
  sessionFileWatcher.stop()
  summaryFileWatcher.stop()
}

export async function prepareVaultSwitch(currentStack?: VaultBoundDiaryStack): Promise<void> {
  if (currentStack) {
    currentStack.shadowIndexSyncService.setSyncEnabled(false)
  }
  await stopVaultWatchers()
  if (currentStack) {
    await currentStack.shadowIndexSyncService.waitForScan()
  }
  await ShadowIndexUpsertOps.waitForIdle()
  await mobileDataBootstrapper.waitUntilIdle()
}

/** 文件级迁移/复制前：停 watcher、刷盘、断开 Shadow DB（不退出应用） */
export async function quiesceStorageForFileCopy(deps: {
  currentStack?: VaultBoundDiaryStack
  settingsManager: SettingsManagerService
}): Promise<void> {
  await prepareVaultSwitch(deps.currentStack)
  await deps.settingsManager.flushToDisk()
  shadowConnectionManager.disconnect()
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
  await connectShadowForActiveVault(deps)
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

let storageRootRebootstrapInFlight: Promise<VaultBoundDiaryStack> | null = null

/** 数据根目录变更后：重载 registry、重连 Shadow DB、重建 diary stack 并全量扫描日记 */
export async function rebootstrapAfterStorageRootChange(deps: {
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
}): Promise<VaultBoundDiaryStack> {
  if (storageRootRebootstrapInFlight) {
    return storageRootRebootstrapInFlight
  }

  const task = (async () => {
    await prepareVaultSwitch(deps.diaryStack)
    await shadowConnectionManager.disconnect()
    await deps.vaultService.initRegistry()
    await connectShadowForActiveVault(deps)

    const diaryStack = createVaultBoundDiaryStack({
      pathService: deps.pathService,
      vaultService: deps.vaultService,
      fileSystem: deps.fileSystem,
      settingsManager: deps.bootstrapDeps.settingsManager
    })
    const bootstrapDeps = buildBootstrapDeps(diaryStack, deps.bootstrapDeps)
    mobileDataBootstrapper.registerDeps(bootstrapDeps)
    diaryStack.shadowIndexSyncService.setSyncEnabled(true)
    await mobileDataBootstrapper.runWhenVaultReady(bootstrapDeps, { force: true })
    await restartVaultWatchers(diaryStack, deps.vaultService, deps.watcherDeps)
    logger.info('[VaultRuntime] Storage root rebootstrap completed')
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

function buildBootstrapDeps(
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
    summarySyncService: bootstrapDeps.summarySyncService
  }
}

async function runVaultBootstrap(
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

  if (options?.deferResync) {
    // 后台 resync 完成后再启动 watcher，避免 fullScanVault 与 VaultFileWatcher 并发写 Shadow DB
    void scheduleVaultEcosystemResync(bootstrapDeps, options.resyncReason ?? 'vault-switch', () => {
      void restartVaultWatchers(deps.diaryStack, deps.vaultService, deps.watcherDeps).finally(() =>
        options.onResyncComplete?.()
      )
    })
    return
  }

  await mobileDataBootstrapper.runWhenVaultReady(bootstrapDeps, { force: true })
  await restartVaultWatchers(deps.diaryStack, deps.vaultService, deps.watcherDeps)
}

async function restartVaultWatchers(
  diaryStack: VaultBoundDiaryStack,
  vaultService: VaultService,
  watcherDeps: VaultRuntimeWatcherDeps,
  options?: { skipSessionSummary?: boolean }
): Promise<void> {
  const activeVault = vaultService.getActiveVault()
  if (!activeVault?.path) {
    vaultFileWatcher.stop()
    sessionFileWatcher.stop()
    summaryFileWatcher.stop()
    return
  }

  vaultFileWatcher.start(activeVault.path, {
    shadowIndexSyncService: diaryStack.shadowIndexSyncService,
    fileSystem: watcherDeps.fileSystem
  })

  if (options?.skipSessionSummary) {
    sessionFileWatcher.stop()
    summaryFileWatcher.stop()
    return
  }

  const sessionsDir = await watcherDeps.pathService.getSessionsBaseDirectory()
  sessionFileWatcher.start(sessionsDir, {
    sessionFileService: watcherDeps.sessionFileService,
    sessionSyncService: watcherDeps.sessionSyncService,
    sessionManager: watcherDeps.sessionManager,
    fileSystem: watcherDeps.fileSystem
  })

  summaryFileWatcher.start(watcherDeps.summarySyncService)
}

export async function activateVaultRuntime(deps: {
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
}): Promise<void> {
  await connectShadowForActiveVault(deps)
  await runVaultBootstrap(deps)
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
    await prepareVaultSwitch(deps.currentStack)

    const active = deps.vaultService.getActiveVault()
    if (active?.name === vaultName && shadowConnectionManager.isConnected() && deps.currentStack) {
      await restartVaultWatchers(deps.currentStack, deps.vaultService, deps.watcherDeps)
      return deps.currentStack
    }

    await deps.vaultService.switchVault(vaultName)

    deps.callbacks?.onStackInvalidated?.()

    await connectShadowForActiveVault(deps)
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
