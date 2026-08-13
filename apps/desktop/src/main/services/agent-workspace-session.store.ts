import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  AgentRoundCheckpoint,
  AgentDialogueSelectionState,
  AgentDialogueSelectionSwitchEvent
} from '@baishou/shared'
import { detectDialogueSelectionSwitches, logger } from '@baishou/shared'

interface WorkspaceSessionBinding {
  sessionId: string
  folderRoot: string
  folderDisplayName?: string
  /** 工作台挂载的知识库笔记本（检索作用域，非 folderRoot） */
  notebookId?: string
  updatedAt: string
  checkpointsByUserMessageId: Record<string, string>
  selection?: AgentDialogueSelectionState
  lastSelectionSwitch?: AgentDialogueSelectionSwitchEvent
}

interface WorkspaceSessionStoreFile {
  bindings: Record<string, WorkspaceSessionBinding>
  checkpoints: Record<string, AgentRoundCheckpoint>
}

const STORE_FILE = 'agent-workspace-sessions.json'

let cache: WorkspaceSessionStoreFile | null = null

function storePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE)
}

async function loadStore(): Promise<WorkspaceSessionStoreFile> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(storePath(), 'utf-8')
    cache = JSON.parse(raw) as WorkspaceSessionStoreFile
  } catch {
    cache = { bindings: {}, checkpoints: {} }
  }
  return cache
}

const PERSIST_DEBOUNCE_MS = 75

let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistChain: Promise<void> = Promise.resolve()
let dirty = false

function writeStoreNow(): Promise<void> {
  persistChain = persistChain
    .then(async () => {
      if (!cache || !dirty) return
      dirty = false
      const file = storePath()
      await fs.mkdir(path.dirname(file), { recursive: true })
      // 不缩进：整份存档每次都要重新序列化，缩进会让搬运的字节数直接翻倍
      await fs.writeFile(file, JSON.stringify(cache), 'utf-8')
    })
    .catch((error) => {
      logger.warn(
        '[WorkspaceSessionStore] persist failed:',
        error instanceof Error ? error.message : String(error)
      )
    })
  return persistChain
}

/**
 * 安排一次写盘。
 *
 * 一轮对话至少触发两次整份存档的序列化，逐次同步写会把主进程卡在 JSON.stringify 上，
 * 表现为 UI 与 IPC 卡顿。这里合并短时间内的多次变更，读取始终走内存缓存，因此不影响一致性。
 */
async function saveStore(): Promise<void> {
  dirty = true
  if (persistTimer != null) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    void writeStoreNow()
  }, PERSIST_DEBOUNCE_MS)
}

/** 进程退出前调用，确保 debounce 中的变更落盘 */
export async function flushWorkspaceSessionStore(): Promise<void> {
  if (persistTimer != null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await writeStoreNow()
}

export async function bindWorkspaceSession(sessionId: string, folderRoot: string): Promise<void> {
  const store = await loadStore()
  const now = new Date().toISOString()
  const folderDisplayName =
    folderRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? folderRoot
  const prev = store.bindings[sessionId]
  store.bindings[sessionId] = {
    sessionId,
    folderRoot,
    folderDisplayName,
    notebookId: prev?.notebookId,
    updatedAt: now,
    checkpointsByUserMessageId: prev?.checkpointsByUserMessageId ?? {},
    selection: prev?.selection,
    lastSelectionSwitch: prev?.lastSelectionSwitch
  }
  await saveStore()
}

export async function attachWorkspaceNotebook(
  sessionId: string,
  notebookId: string | null
): Promise<WorkspaceSessionBinding | null> {
  const store = await loadStore()
  const binding = store.bindings[sessionId]
  if (!binding) return null
  const trimmed = notebookId?.trim() || ''
  if (trimmed) {
    binding.notebookId = trimmed
  } else {
    delete binding.notebookId
  }
  binding.updatedAt = new Date().toISOString()
  await saveStore()
  return binding
}

export async function touchWorkspaceSession(sessionId: string): Promise<void> {
  const store = await loadStore()
  const binding = store.bindings[sessionId]
  if (!binding) return
  binding.updatedAt = new Date().toISOString()
  await saveStore()
}

export async function listWorkspaceSessions(): Promise<WorkspaceSessionBinding[]> {
  const store = await loadStore()
  return Object.values(store.bindings)
    .map((binding) => ({
      ...binding,
      updatedAt: binding.updatedAt ?? ''
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getWorkspaceSessionBinding(
  sessionId: string
): Promise<WorkspaceSessionBinding | null> {
  const store = await loadStore()
  return store.bindings[sessionId] ?? null
}

export async function saveWorkspaceCheckpoint(checkpoint: AgentRoundCheckpoint): Promise<void> {
  const store = await loadStore()
  store.checkpoints[checkpoint.id] = checkpoint
  const binding = store.bindings[checkpoint.sessionId]
  if (binding) {
    binding.checkpointsByUserMessageId[checkpoint.userMessageId] = checkpoint.id
  }
  await saveStore()
}

export async function getWorkspaceCheckpoint(
  checkpointId: string
): Promise<AgentRoundCheckpoint | null> {
  const store = await loadStore()
  return store.checkpoints[checkpointId] ?? null
}

export async function getWorkspaceCheckpointForUserMessage(
  sessionId: string,
  userMessageId: string
): Promise<AgentRoundCheckpoint | null> {
  const store = await loadStore()
  const binding = store.bindings[sessionId]
  if (!binding) return null
  const checkpointId = binding.checkpointsByUserMessageId[userMessageId]
  if (!checkpointId) return null
  return store.checkpoints[checkpointId] ?? null
}

/** 删除指定 user 消息对应的 checkpoint（回滚截断后清理映射与正文） */
export async function removeWorkspaceCheckpointsForUserMessages(
  sessionId: string,
  userMessageIds: string[]
): Promise<void> {
  if (userMessageIds.length === 0) return
  const store = await loadStore()
  const binding = store.bindings[sessionId]
  if (!binding) return

  for (const userMessageId of userMessageIds) {
    const checkpointId = binding.checkpointsByUserMessageId[userMessageId]
    if (checkpointId) {
      delete store.checkpoints[checkpointId]
      delete binding.checkpointsByUserMessageId[userMessageId]
    }
  }
  binding.updatedAt = new Date().toISOString()
  await saveStore()
}

function sameFolder(a: string, b: string): boolean {
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase()
}

/** 还有多少会话绑定着这个文件夹——影子仓库按文件夹共享，清理前必须先问这个 */
export async function countWorkspaceSessionsForFolder(folderRoot: string): Promise<number> {
  const store = await loadStore()
  return Object.values(store.bindings).filter((binding) =>
    sameFolder(binding.folderRoot, folderRoot)
  ).length
}

/**
 * 这个文件夹下所有还能被回滚到的 tree oid。
 *
 * 影子仓库回收对象时要靠它划定「还有用」的边界：漏掉一个，对应轮次的正文就被 gc 抹掉了，
 * 所以这里按文件夹取全量，而不是只看当前会话。
 */
export async function listWorkspaceCheckpointTreeOids(folderRoot: string): Promise<string[]> {
  const store = await loadStore()
  const oids = new Set<string>()

  for (const binding of Object.values(store.bindings)) {
    if (!sameFolder(binding.folderRoot, folderRoot)) continue
    for (const checkpointId of Object.values(binding.checkpointsByUserMessageId)) {
      const checkpoint = store.checkpoints[checkpointId]
      if (checkpoint?.startTreeOid) oids.add(checkpoint.startTreeOid)
      if (checkpoint?.endTreeOid) oids.add(checkpoint.endTreeOid)
    }
  }

  return [...oids]
}

export async function removeWorkspaceSession(sessionId: string): Promise<void> {
  const store = await loadStore()
  const binding = store.bindings[sessionId]
  if (binding) {
    for (const checkpointId of Object.values(binding.checkpointsByUserMessageId)) {
      delete store.checkpoints[checkpointId]
    }
    delete store.bindings[sessionId]
    await saveStore()
  }
}

export function hydrateCheckpointService(
  service: import('@baishou/ai').AgentRoundCheckpointService,
  checkpoints: AgentRoundCheckpoint[]
): void {
  for (const checkpoint of checkpoints) {
    service.restoreCheckpoint(checkpoint)
  }
}

export async function loadSessionCheckpointsIntoService(
  sessionId: string,
  service: import('@baishou/ai').AgentRoundCheckpointService
): Promise<void> {
  const store = await loadStore()
  const binding = store.bindings[sessionId]
  if (!binding) return
  const checkpoints = Object.values(binding.checkpointsByUserMessageId)
    .map((id) => store.checkpoints[id])
    .filter((checkpoint): checkpoint is AgentRoundCheckpoint => Boolean(checkpoint))
  hydrateCheckpointService(service, checkpoints)
  logger.info(`[WorkspaceSessionStore] hydrated ${checkpoints.length} checkpoints for ${sessionId}`)
}

export async function updateWorkspaceSessionSelection(
  sessionId: string,
  next: AgentDialogueSelectionState
): Promise<AgentDialogueSelectionSwitchEvent | undefined> {
  const store = await loadStore()
  const binding = store.bindings[sessionId]
  if (!binding) return undefined

  const switches = detectDialogueSelectionSwitches(binding.selection, next, sessionId)
  binding.selection = next
  if (switches.length > 0) {
    binding.lastSelectionSwitch = switches[switches.length - 1]
    logger.info(
      `[WorkspaceSessionStore] selection switch session=${sessionId} kinds=${switches.map((e) => e.kind).join(',')}`
    )
  }
  binding.updatedAt = new Date().toISOString()
  await saveStore()
  return binding.lastSelectionSwitch
}

export async function getWorkspaceSessionSelection(
  sessionId: string
): Promise<AgentDialogueSelectionState | null> {
  const store = await loadStore()
  return store.bindings[sessionId]?.selection ?? null
}
