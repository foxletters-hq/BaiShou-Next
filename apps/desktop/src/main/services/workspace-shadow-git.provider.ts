import { createHash } from 'node:crypto'
import { rm, stat, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { app } from 'electron'
import {
  createFallbackSnapshotStore,
  createGitShadowSnapshotStore,
  createInlineSnapshotStore,
  createKeyedMutex,
  createNodeWorkspaceFs,
  pruneShadowSnapshotObjects,
  type FallbackSnapshotStore,
  type WorkspaceGitRunner
} from '@baishou/ai'
import { runBundledGit } from '@baishou/core-desktop'
import { logger } from '@baishou/shared'
import {
  countWorkspaceSessionsForFolder,
  listWorkspaceCheckpointTreeOids
} from './agent-workspace-session.store'

const SHADOW_ROOT_DIR = 'workspace-shadow-git'
/** 首次 capture 要遍历整个工作台目录，超过这个时长就认定目录过大，降级处理 */
const GIT_COMMAND_TIMEOUT_MS = 15_000
const MAX_SNAPSHOT_FILE_COUNT = 20_000

const runGit: WorkspaceGitRunner = ({ args, cwd, stdin, timeoutMs }) =>
  runBundledGit({ args, cwd, stdin, timeoutMs })

export function getWorkspaceShadowGitRoot(): string {
  return join(app.getPath('userData'), SHADOW_ROOT_DIR)
}

/**
 * 影子仓库的位置。
 *
 * 用哈希而不是原路径命名：工作台路径可能很长、含中文或盘符，直接映射成目录名
 * 在 Windows 上会踩长路径与非法字符。前缀保留一段可读名字，方便人工排查。
 */
export function resolveWorkspaceShadowGitDir(folderRoot: string): string {
  const normalized = resolve(folderRoot).replace(/\\/g, '/').toLowerCase()
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  const readable =
    resolve(folderRoot)
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .pop()
      ?.replace(/[^\w.-]+/g, '_')
      .slice(0, 24) ?? 'workspace'
  return join(getWorkspaceShadowGitRoot(), `${readable}-${digest}`)
}

let store: FallbackSnapshotStore | null = null
/** 快照与 gc 共用同一把锁，否则 gc 会和正在进行的 capture 抢 index.lock */
const shadowMutex = createKeyedMutex()

/**
 * 工作台快照存储：优先用影子 Git，出问题时退回纯文本快照。
 *
 * 影子仓库放在应用数据目录，工作树指向用户文件夹，因此用户目录里不会多出 `.git`，
 * 也不会产生任何提交；用户自己的仓库完全不受影响。
 */
export function getWorkspaceSnapshotStore(): FallbackSnapshotStore {
  if (store) return store

  store = createFallbackSnapshotStore({
    primary: createGitShadowSnapshotStore({
      runGit,
      resolveGitDir: resolveWorkspaceShadowGitDir,
      mutex: shadowMutex,
      commandTimeoutMs: GIT_COMMAND_TIMEOUT_MS,
      maxSnapshotFileCount: MAX_SNAPSHOT_FILE_COUNT,
      onWarn: (message, detail) => logger.warn(`[WorkspaceSnapshot] ${message}`, detail)
    }),
    fallback: createInlineSnapshotStore(createNodeWorkspaceFs()),
    onDowngrade: ({ folderRoot, error }) => {
      logger.warn(
        `[WorkspaceSnapshot] shadow git unavailable, falling back to inline snapshots folder=${folderRoot}`,
        error instanceof Error ? error.message : String(error)
      )
    }
  })

  return store
}

/**
 * 清掉某个工作台的影子仓库。
 *
 * 只有在没有任何会话还指向这个文件夹时才该调用：仓库里存着历史检查点的全部正文，
 * 删早了那些会话就再也回滚不了。
 */
export async function removeWorkspaceShadowGit(folderRoot: string): Promise<void> {
  const gitDir = resolveWorkspaceShadowGitDir(folderRoot)
  try {
    await rm(gitDir, { recursive: true, force: true, maxRetries: 3 })
    lastMeasuredAt.delete(folderRoot)
    getWorkspaceSnapshotStore().clearDowngrade(folderRoot)
  } catch (error) {
    logger.warn(
      `[WorkspaceSnapshot] failed to remove shadow repository ${gitDir}:`,
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * 没有会话再用这个文件夹时，把影子仓库一并收掉；否则只做一次按需回收。
 *
 * 会话与工作台是两条独立的删除路径，但影子仓库只有一份，所以两边都要在删完之后
 * 回头问一句「还有人用吗」。
 */
export async function cleanupUnusedWorkspaceShadowGit(folderRoot: string): Promise<boolean> {
  if ((await countWorkspaceSessionsForFolder(folderRoot)) > 0) {
    await maybePruneWorkspaceShadowGit(folderRoot)
    return false
  }
  await removeWorkspaceShadowGit(folderRoot)
  return true
}

export interface ShadowGitUsage {
  gitDir: string
  bytes: number
}

async function directorySize(absolutePath: string): Promise<number> {
  let total = 0
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const child = join(absolutePath, entry.name)
    if (entry.isDirectory()) {
      total += await directorySize(child)
      continue
    }
    const stats = await stat(child).catch(() => null)
    if (stats?.isFile()) total += stats.size
  }
  return total
}

export async function measureWorkspaceShadowGit(folderRoot: string): Promise<ShadowGitUsage> {
  const gitDir = resolveWorkspaceShadowGitDir(folderRoot)
  return { gitDir, bytes: await directorySize(gitDir) }
}

const MAX_SHADOW_REPO_BYTES = 512 * 1024 * 1024
const MEASURE_INTERVAL_MS = 30 * 60 * 1000
const GC_TIMEOUT_MS = 120_000
const lastMeasuredAt = new Map<string, number>()

/**
 * 按需回收影子仓库。
 *
 * 量体积本身要递归整个对象库，因此对同一工作台做节流；只有确实超标才付 gc 的代价。
 */
export async function maybePruneWorkspaceShadowGit(folderRoot: string): Promise<void> {
  const now = Date.now()
  const measuredAt = lastMeasuredAt.get(folderRoot) ?? 0
  if (now - measuredAt < MEASURE_INTERVAL_MS) return
  lastMeasuredAt.set(folderRoot, now)

  const { bytes } = await measureWorkspaceShadowGit(folderRoot)
  if (bytes < MAX_SHADOW_REPO_BYTES) return

  logger.info(
    `[WorkspaceSnapshot] shadow repository is ${Math.round(bytes / 1024 / 1024)}MB, running gc folder=${folderRoot}`
  )
  await pruneWorkspaceShadowGit(folderRoot)
}

/**
 * 回收影子仓库里已经没人引用的对象。
 *
 * 建仓时关掉了 auto gc，好让每次 capture 的耗时可预测，代价是对象只增不减，
 * 因此需要在轮次之外的时机显式回收。哪些树还有用，以检查点存档为准。
 */
export async function pruneWorkspaceShadowGit(folderRoot: string): Promise<void> {
  const gitDir = resolveWorkspaceShadowGitDir(folderRoot)
  const liveTreeOids = await listWorkspaceCheckpointTreeOids(folderRoot)

  const result = await pruneShadowSnapshotObjects({
    runGit,
    gitDir,
    folderRoot,
    liveTreeOids,
    mutex: shadowMutex,
    timeoutMs: GC_TIMEOUT_MS,
    onWarn: (message, detail) => logger.warn(`[WorkspaceSnapshot] ${message}`, detail)
  }).catch((error: unknown) => {
    logger.warn(
      `[WorkspaceSnapshot] shadow gc failed folder=${folderRoot}:`,
      error instanceof Error ? error.message : String(error)
    )
    return null
  })

  if (result?.collected) {
    logger.info(
      `[WorkspaceSnapshot] shadow gc released ${result.releasedRefs} snapshot(s) folder=${folderRoot}`
    )
  }
}
