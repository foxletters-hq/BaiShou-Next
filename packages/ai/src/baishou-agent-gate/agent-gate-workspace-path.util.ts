import type { AgentGateResourceRef } from '@baishou/shared'
import {
  normalizeWorkspaceRelativePath,
  resolveWorkspacePath,
  toWorkspaceRelativePath,
  WorkspacePathError
} from '../agent-workspace/workspace-path.sandbox'

function looksAbsolutePath(value: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(value)
}

/**
 * Classify a workspace tool path for Gate resources.
 * Paths that escape the sandbox (or look absolute without a root) become `external_path`.
 */
export function classifyWorkspacePathForGate(
  inputPath: string,
  folderRoot?: string
): AgentGateResourceRef {
  const trimmed = inputPath.trim().replace(/\\/g, '/')

  if (looksAbsolutePath(inputPath.trim())) {
    if (folderRoot) {
      try {
        const relative = toWorkspaceRelativePath(folderRoot, inputPath.trim())
        return { kind: 'workspace_path', value: relative || '.' }
      } catch (error) {
        if (error instanceof WorkspacePathError) {
          return { kind: 'external_path', value: trimmed }
        }
        throw error
      }
    }
    return { kind: 'external_path', value: trimmed }
  }

  try {
    const relative = normalizeWorkspaceRelativePath(inputPath)
    if (folderRoot) {
      resolveWorkspacePath(folderRoot, relative)
    }
    return { kind: 'workspace_path', value: relative || '.' }
  } catch (error) {
    if (error instanceof WorkspacePathError) {
      return { kind: 'external_path', value: trimmed }
    }
    throw error
  }
}
