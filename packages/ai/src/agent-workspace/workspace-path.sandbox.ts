// @ts-ignore - Node built-in, available at runtime
import { resolve, relative } from 'node:path'

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspacePathError'
  }
}

/** Normalize a workspace-relative path and reject traversal attempts. */
export function normalizeWorkspaceRelativePath(inputPath: string): string {
  if (inputPath == null || typeof inputPath !== 'string') {
    throw new WorkspacePathError('Path is required')
  }
  if (inputPath.includes('\0')) {
    throw new WorkspacePathError('Invalid path')
  }

  const trimmed = inputPath.trim()
  if (trimmed === '' || trimmed === '.' || trimmed === './') {
    return ''
  }

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter((segment) => segment.length > 0)

  for (const segment of segments) {
    if (segment === '..') {
      throw new WorkspacePathError('Path escapes workspace root')
    }
  }

  return segments.filter((segment) => segment !== '.').join('/')
}

/** Resolve a relative path inside folderRoot; throws if outside the sandbox. */
export function resolveWorkspacePath(folderRoot: string, relativePath: string): string {
  const rel = normalizeWorkspaceRelativePath(relativePath)
  const root = resolve(folderRoot)
  const absolute = resolve(root, rel)
  const relToRoot = relative(root, absolute)

  if (relToRoot.startsWith('..') || relToRoot.split(/[\\/]/).includes('..')) {
    throw new WorkspacePathError('Path escapes workspace root')
  }

  return absolute
}

/** Return the workspace-relative path for an absolute path under folderRoot. */
export function toWorkspaceRelativePath(folderRoot: string, absolutePath: string): string {
  const root = resolve(folderRoot)
  const absolute = resolve(absolutePath)
  const rel = relative(root, absolute)

  if (rel.startsWith('..') || rel.split(/[\\/]/).includes('..')) {
    throw new WorkspacePathError('Path escapes workspace root')
  }

  return rel.replace(/\\/g, '/')
}
