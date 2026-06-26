import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { AgentRoundCheckpoint, AgentDialogueSelectionState, AgentDialogueSelectionSwitchEvent } from '@baishou/shared'
import { detectDialogueSelectionSwitches, logger } from '@baishou/shared'

interface WorkspaceSessionBinding {
  sessionId: string
  folderRoot: string
  folderDisplayName?: string
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

async function saveStore(): Promise<void> {
  if (!cache) return
  await fs.mkdir(path.dirname(storePath()), { recursive: true })
  await fs.writeFile(storePath(), JSON.stringify(cache, null, 2), 'utf-8')
}

export async function bindWorkspaceSession(
  sessionId: string,
  folderRoot: string
): Promise<void> {
  const store = await loadStore()
  const now = new Date().toISOString()
  const folderDisplayName =
    folderRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? folderRoot
  store.bindings[sessionId] = {
    sessionId,
    folderRoot,
    folderDisplayName,
    updatedAt: now,
    checkpointsByUserMessageId: store.bindings[sessionId]?.checkpointsByUserMessageId ?? {}
  }
  await saveStore()
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
