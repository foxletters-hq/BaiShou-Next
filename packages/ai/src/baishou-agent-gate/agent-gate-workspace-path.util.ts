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

/**
 * 将区外文件/目录路径规范为目录 glob（供 external_directory 门使用）。
 * 例：`D:/Notes/a.md` → `D:/Notes/**`；`D:/Notes` → `D:/Notes/**`
 */
export function externalPathToDirectoryGlob(pathValue: string): string {
  let normalized = pathValue.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalized) return '/**'

  if (normalized.includes('*')) {
    if (normalized.endsWith('/**') || normalized.endsWith('/*')) {
      return normalized.replace(/\/\*$/, '/**')
    }
    return normalized.includes('/')
      ? `${normalized.replace(/\/[^/]*$/, '')}/**`
      : `${normalized}/**`
  }

  const lastSeg = normalized.split('/').pop() ?? ''
  const looksLikeFile = lastSeg.includes('.') && !lastSeg.startsWith('.')
  if (looksLikeFile) {
    const slash = normalized.lastIndexOf('/')
    const dir = slash >= 0 ? normalized.slice(0, slash) : ''
    return dir ? `${dir}/**` : '/**'
  }

  return `${normalized}/**`
}

/** 从资源列表提取去重后的区外目录 glob */
export function collectExternalDirectoryGlobs(
  resources: readonly AgentGateResourceRef[]
): string[] {
  const seen = new Set<string>()
  const globs: string[] = []
  for (const resource of resources) {
    if (resource.kind !== 'external_path') continue
    const glob = externalPathToDirectoryGlob(resource.value)
    if (seen.has(glob)) continue
    seen.add(glob)
    globs.push(glob)
  }
  return globs
}
