import { app, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import type { AgentWorkspaceEntry, AgentWorkspaceEntryUpdate } from '@baishou/shared'
import { listWorkspaceSessions } from './agent-workspace-session.store'
import {
  dedupeAgentWorkspacesByFolder,
  folderDisplayName,
  normalizeWorkspaceFolderKey,
  reconcileRegistryFromSessionBindings,
  resolveValidLastActiveWorkspaceId
} from './agent-workspace-registry.util'

interface WorkspaceRegistryFile {
  workspaces: AgentWorkspaceEntry[]
  lastActiveWorkspaceId?: string
}

const STORE_FILE = 'agent-workspace-registry.json'

let cache: WorkspaceRegistryFile | null = null

function storePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE)
}

async function loadRegistry(): Promise<WorkspaceRegistryFile> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(storePath(), 'utf-8')
    cache = JSON.parse(raw) as WorkspaceRegistryFile
  } catch {
    cache = { workspaces: [] }
  }
  if (!cache.workspaces) {
    cache.workspaces = []
  }
  return cache
}

async function saveRegistry(): Promise<void> {
  if (!cache) return
  await fs.mkdir(path.dirname(storePath()), { recursive: true })
  await fs.writeFile(storePath(), JSON.stringify(cache, null, 2), 'utf-8')
}

function findWorkspaceByFolder(
  workspaces: AgentWorkspaceEntry[],
  folderRoot: string
): AgentWorkspaceEntry | undefined {
  const key = normalizeWorkspaceFolderKey(folderRoot)
  return workspaces.find((entry) => normalizeWorkspaceFolderKey(entry.folderRoot) === key)
}

async function syncFromSessionBindings(
  registry: WorkspaceRegistryFile,
  workspaces: AgentWorkspaceEntry[]
): Promise<AgentWorkspaceEntry[]> {
  const bindings = (await listWorkspaceSessions()).map((binding) => ({
    folderRoot: path.resolve(binding.folderRoot),
    folderDisplayName: binding.folderDisplayName
  }))
  const merged = reconcileRegistryFromSessionBindings(
    workspaces,
    bindings,
    () => crypto.randomUUID(),
    new Date().toISOString()
  )
  registry.lastActiveWorkspaceId = resolveValidLastActiveWorkspaceId(
    registry.lastActiveWorkspaceId,
    merged
  )
  return merged
}

export async function listAgentWorkspaces(): Promise<AgentWorkspaceEntry[]> {
  const registry = await loadRegistry()
  const merged = await syncFromSessionBindings(registry, [...registry.workspaces])
  registry.workspaces = merged
  await saveRegistry()
  return merged
}

export async function addAgentWorkspace(folderRoot: string): Promise<AgentWorkspaceEntry> {
  const resolved = path.resolve(folderRoot)
  const registry = await loadRegistry()
  registry.workspaces = dedupeAgentWorkspacesByFolder(registry.workspaces)
  const existing = findWorkspaceByFolder(registry.workspaces, resolved)
  if (existing) {
    existing.updatedAt = new Date().toISOString()
    await saveRegistry()
    return existing
  }

  const now = new Date().toISOString()
  const entry: AgentWorkspaceEntry = {
    id: crypto.randomUUID(),
    folderRoot: resolved,
    displayName: folderDisplayName(resolved),
    avatarPath: null,
    createdAt: now,
    updatedAt: now
  }
  registry.workspaces.push(entry)
  await saveRegistry()
  return entry
}

export async function updateAgentWorkspace(
  workspaceId: string,
  patch: AgentWorkspaceEntryUpdate
): Promise<AgentWorkspaceEntry | null> {
  const registry = await loadRegistry()
  const entry = registry.workspaces.find((item) => item.id === workspaceId)
  if (!entry) return null

  if (patch.displayName !== undefined) {
    entry.displayName = patch.displayName.trim() || folderDisplayName(entry.folderRoot)
  }
  if (patch.avatarPath !== undefined) {
    entry.avatarPath = patch.avatarPath
  }
  entry.updatedAt = new Date().toISOString()
  await saveRegistry()
  return entry
}

export async function getLastActiveWorkspaceId(): Promise<string | undefined> {
  const registry = await loadRegistry()
  return registry.lastActiveWorkspaceId
}

export async function setLastActiveWorkspaceId(workspaceId: string | null): Promise<void> {
  const registry = await loadRegistry()
  registry.lastActiveWorkspaceId = workspaceId ?? undefined
  await saveRegistry()
}

export async function pickWorkspaceAvatarImage(
  parentWindow?: BrowserWindow | null
): Promise<string | null> {
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
      })
    : await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
      })

  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  return `file://${filePath.replace(/\\/g, '/')}`
}
