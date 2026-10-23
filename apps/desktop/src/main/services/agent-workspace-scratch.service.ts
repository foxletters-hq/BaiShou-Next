import { app } from 'electron'
import { constants as fsConstants } from 'fs'
import * as fs from 'fs/promises'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import {
  addAgentWorkspace,
  listAgentWorkspaces,
  updateAgentWorkspace
} from './agent-workspace-registry.store'
import { normalizeWorkspaceFolderKey } from './agent-workspace-registry.util'
import { retargetWorkspaceSessionFolders } from './agent-workspace-session.store'
import {
  isScratchWorkspaceEntry,
  listLegacyScratchFolderCandidates,
  resolveAppInstallRoot,
  resolveScratchWorkspaceFolderRoot,
  SCRATCH_WORKSPACE_DISPLAY_NAME
} from './agent-workspace-scratch.util'

/**
 * 确保「稿纸」默认工作区存在：建在用户文档目录下，不可写时回退 userData。
 * 幂等：已存在则校验目录、纠正 displayName/kind/路径后返回。
 */
export async function ensureScratchWorkspace(): Promise<AgentWorkspaceEntry> {
  const folderRoot = await resolveWritableScratchFolderRoot()

  const workspaces = await listAgentWorkspaces()
  const existing = workspaces.find((entry) => isScratchWorkspaceEntry(entry))
  if (existing) {
    const needsPatch =
      existing.kind !== 'scratch' ||
      existing.displayName !== SCRATCH_WORKSPACE_DISPLAY_NAME ||
      normalizeWorkspaceFolderKey(existing.folderRoot) !== normalizeWorkspaceFolderKey(folderRoot)

    if (!needsPatch) return existing

    if (
      normalizeWorkspaceFolderKey(existing.folderRoot) !== normalizeWorkspaceFolderKey(folderRoot)
    ) {
      await retargetWorkspaceSessionFolders(existing.folderRoot, folderRoot)
    }

    const updated = await updateAgentWorkspace(existing.id, {
      displayName: SCRATCH_WORKSPACE_DISPLAY_NAME,
      kind: 'scratch',
      folderRoot
    })
    return (
      updated ?? {
        ...existing,
        displayName: SCRATCH_WORKSPACE_DISPLAY_NAME,
        kind: 'scratch',
        folderRoot
      }
    )
  }

  const created = await addAgentWorkspace(folderRoot)
  const updated = await updateAgentWorkspace(created.id, {
    displayName: SCRATCH_WORKSPACE_DISPLAY_NAME,
    kind: 'scratch'
  })
  return updated ?? { ...created, displayName: SCRATCH_WORKSPACE_DISPLAY_NAME, kind: 'scratch' }
}

/**
 * 读取工作区列表前自愈：仅当注册表里仍有「稿纸」但目录已不存在时重建。
 * 用户已从注册表移除的稿纸没有条目，因此不会被复活。
 */
export async function listAgentWorkspacesRepairingScratch(): Promise<AgentWorkspaceEntry[]> {
  const workspaces = await listAgentWorkspaces()
  const scratch = workspaces.find((entry) => isScratchWorkspaceEntry(entry))
  if (!scratch || !(await isMissingDirectory(scratch.folderRoot))) {
    return workspaces
  }

  await ensureScratchWorkspace()
  return listAgentWorkspaces()
}

async function isMissingDirectory(folderRoot: string): Promise<boolean> {
  try {
    return !(await fs.stat(folderRoot)).isDirectory()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    // 只有明确的“不存在”才自愈；权限等异常先保持原状，避免误迁移会话
    return code === 'ENOENT' || code === 'ENOTDIR'
  }
}

async function resolveWritableScratchFolderRoot(): Promise<string> {
  const preferred = resolveScratchWorkspaceFolderRoot({
    documentsRoot: app.getPath('documents'),
    userDataRoot: app.getPath('userData')
  })

  try {
    await fs.mkdir(preferred, { recursive: true })
    await fs.access(preferred, fsConstants.W_OK)
    await adoptLegacyScratchFolderIfNeeded(preferred)
    return preferred
  } catch {
    const fallback = resolveScratchWorkspaceFolderRoot({
      documentsRoot: null,
      userDataRoot: app.getPath('userData')
    })
    await fs.mkdir(fallback, { recursive: true })
    return fallback
  }
}

async function isEmptyDirectory(folder: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(folder)
    return entries.length === 0
  } catch {
    return true
  }
}

async function adoptLegacyScratchFolderIfNeeded(preferred: string): Promise<void> {
  if (!(await isEmptyDirectory(preferred))) return

  const installRoot = resolveAppInstallRoot({
    isPackaged: app.isPackaged,
    exePath: app.getPath('exe'),
    appPath: app.getAppPath()
  })
  const preferredKey = normalizeWorkspaceFolderKey(preferred)
  const candidates = listLegacyScratchFolderCandidates({
    installRoot,
    userDataRoot: app.getPath('userData')
  })

  for (const oldFolder of candidates) {
    if (normalizeWorkspaceFolderKey(oldFolder) === preferredKey) continue
    try {
      const stat = await fs.stat(oldFolder)
      if (!stat.isDirectory()) continue
      if (await isEmptyDirectory(oldFolder)) continue
      await fs.rmdir(preferred)
      try {
        await fs.rename(oldFolder, preferred)
        return
      } catch {
        await fs.mkdir(preferred, { recursive: true })
      }
    } catch {
      continue
    }
  }
}
