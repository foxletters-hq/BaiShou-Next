import { app } from 'electron'
import { constants as fsConstants } from 'fs'
import * as fs from 'fs/promises'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import {
  addAgentWorkspace,
  listAgentWorkspaces,
  updateAgentWorkspace
} from './agent-workspace-registry.store'
import {
  isScratchWorkspaceEntry,
  resolveAppInstallRoot,
  resolveScratchWorkspaceFolderRoot,
  SCRATCH_WORKSPACE_DISPLAY_NAME
} from './agent-workspace-scratch.util'

/**
 * 确保「稿纸」默认工作区存在：优先建在软件安装目录下，不可写时回退 userData。
 * 幂等：已存在则校验目录、纠正 displayName/kind 后返回。
 */
export async function ensureScratchWorkspace(): Promise<AgentWorkspaceEntry> {
  const folderRoot = await resolveWritableScratchFolderRoot()

  const workspaces = await listAgentWorkspaces()
  const existing = workspaces.find((entry) => isScratchWorkspaceEntry(entry))
  if (existing) {
    const needsPatch =
      existing.kind !== 'scratch' ||
      existing.displayName !== SCRATCH_WORKSPACE_DISPLAY_NAME ||
      existing.folderRoot !== folderRoot

    if (!needsPatch) return existing

    // 目录迁移：若旧路径不同，以当前解析路径为准重新注册
    if (existing.folderRoot !== folderRoot) {
      const created = await addAgentWorkspace(folderRoot)
      const updated = await updateAgentWorkspace(created.id, {
        displayName: SCRATCH_WORKSPACE_DISPLAY_NAME,
        kind: 'scratch'
      })
      return updated ?? { ...created, displayName: SCRATCH_WORKSPACE_DISPLAY_NAME, kind: 'scratch' }
    }

    const updated = await updateAgentWorkspace(existing.id, {
      displayName: SCRATCH_WORKSPACE_DISPLAY_NAME,
      kind: 'scratch'
    })
    return (
      updated ?? {
        ...existing,
        displayName: SCRATCH_WORKSPACE_DISPLAY_NAME,
        kind: 'scratch'
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

async function resolveWritableScratchFolderRoot(): Promise<string> {
  const installRoot = resolveAppInstallRoot({
    isPackaged: app.isPackaged,
    exePath: app.getPath('exe'),
    appPath: app.getAppPath()
  })
  const preferred = resolveScratchWorkspaceFolderRoot({
    installRoot,
    userDataRoot: app.getPath('userData')
  })

  try {
    await fs.mkdir(preferred, { recursive: true })
    await fs.access(preferred, fsConstants.W_OK)
    return preferred
  } catch {
    const fallback = resolveScratchWorkspaceFolderRoot({
      installRoot: null,
      userDataRoot: app.getPath('userData')
    })
    await fs.mkdir(fallback, { recursive: true })
    return fallback
  }
}
