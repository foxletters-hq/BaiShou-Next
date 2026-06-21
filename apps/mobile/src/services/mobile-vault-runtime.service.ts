import {
  DiaryService,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl,
  VaultService,
  journalMarkdownExistsInTree,
  countJournalMarkdownInTree,
  path,
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
import {
  scheduleVaultEcosystemResync,
  waitForVaultEcosystemResync
} from './mobile-vault-resync.service'
import { vaultFileWatcher } from './vault-file-watcher.service'
import { sessionFileWatcher } from './session-file-watcher.service'
import { summaryFileWatcher } from './summary-file-watcher.service'
import { createShadowDiaryRepoAdapter } from './shadow-diary-adapter'
import { getMobileDiaryEmbeddingCallback } from './mobile-diary-embedding.service'
import { ExternalStorageRequiredError } from './storage-required.error'
import type { SessionFileService } from '@baishou/core-mobile'
import type { SessionSyncService } from '@baishou/core-mobile'
import type { DiaryRepository } from '@baishou/database'

/** 每次 Vault 切换递增；用于丢弃过期的 deferResync onComplete，避免重连 Shadow DB 时 watcher 仍持有旧连接 */
let vaultRuntimeGeneration = 0

function bumpVaultRuntimeGeneration(): number {
  vaultRuntimeGeneration += 1
  return vaultRuntimeGeneration
}

function isVaultRuntimeGenerationCurrent(generation: number): boolean {
  return generation === vaultRuntimeGeneration
}

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
  await connectGlobalShadowDb(deps)
  return createVaultBoundDiaryStack(deps)
}

export function createVaultBoundDiaryStack(deps: {
  pathService: IStoragePathService
  vaultService: VaultService
  fileSystem: IFileSystem
  settingsManager?: SettingsManagerService
}): VaultBoundDiaryStack {
  const activeVault = deps.vaultService.getActiveVault()
  if (!activeVault) {
    throw new Error('[VaultRuntime] 无活跃 Vault，无法创建日记栈')
  }
  const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), activeVault.name)
  const fileSyncService = new FileSyncServiceImpl(deps.pathService, deps.fileSystem)
  const vaultIndexService = new VaultIndexServiceImpl()
  const shadowIndexSyncService = new ShadowIndexSyncService(
    shadowRepo,
    deps.pathService,
    deps.vaultService,
    deps.fileSystem,
    getMobileDiaryEmbeddingCallback()
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
  // deferResync 的 onComplete 可能在 waitUntilIdle 期间重启 watcher，切换继续前再停一次
  await stopVaultWatchers()
}

/** 文件级迁移/复制前：停 watcher、刷盘、断开 Shadow DB（不退出应用） */
export async function quiesceStorageForFileCopy(deps: {
  currentStack?: VaultBoundDiaryStack
  settingsManager: SettingsManagerService
}): Promise<void> {
  bumpVaultRuntimeGeneration()
  await prepareVaultSwitch(deps.currentStack)
  await deps.settingsManager.flushToDisk()
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

export type StorageRootRebootstrapOptions = {
  /** 归档全量恢复后阻塞扫描，避免沿用旧 Shadow 索引导致日记列表不正确 */
  blockingResync?: boolean
}

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
    await prepareVaultSwitch(deps.diaryStack)
    await deps.vaultService.initRegistry()
    if (blockingResync) {
      await preferActiveVaultWithJournalsOnDisk(deps)
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
    const bootstrapDeps = buildBootstrapDeps(diaryStack, deps.bootstrapDeps)
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
    summarySyncService: bootstrapDeps.summarySyncService,
    getActiveVaultName: bootstrapDeps.getActiveVaultName
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

async function shouldDeferVaultResync(
  deps: {
    diaryStack: VaultBoundDiaryStack
    vaultService: VaultService
    fileSystem: IFileSystem
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

    const journalsDir = path.join(active.path, 'Journals')
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

async function preferActiveVaultWithJournalsOnDisk(deps: {
  vaultService: VaultService
  fileSystem: IFileSystem
}): Promise<void> {
  const vaults = deps.vaultService.getAllVaults()
  if (vaults.length === 0) return

  const scored: Array<{ name: string; score: number; journals: number; archives: number }> = []
  for (const vault of vaults) {
    const journalsDir = path.join(vault.path, 'Journals')
    const journalCount = await countJournalMarkdownInTree(deps.fileSystem, journalsDir)
    const archiveCount = await countArchiveMarkdownInTree(deps.fileSystem, vault.path)
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
    /** 跳过上架日记存在时的阻塞全量扫描（旧版迁移完成后使用，避免 OOM 闪退） */
    forceDeferResync?: boolean
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
      const records = await deps.diaryStack.shadowRepo.getAllRecords()
      if (records.length > 0) {
        logger.info('[VaultRuntime] Shadow index already populated; skipping shadow resync')
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
    const generation = vaultRuntimeGeneration
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

export type ActivateVaultRuntimeOptions = {
  /** 后台 resync，避免冷启动阻塞 UI（默认 true） */
  deferResync?: boolean
  /** 强制后台 resync，不因磁盘已有日记而阻塞全量扫描 */
  forceDeferResync?: boolean
  resyncReason?: string
  onResyncComplete?: () => void
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
    await prepareVaultSwitch(deps.currentStack)

    const active = deps.vaultService.getActiveVault()
    if (active?.name === vaultName && deps.currentStack) {
      await restartVaultWatchers(deps.currentStack, deps.vaultService, deps.watcherDeps)
      return deps.currentStack
    }

    await deps.vaultService.switchVault(vaultName)

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
