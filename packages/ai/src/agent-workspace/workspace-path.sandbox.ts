// @ts-ignore - Node built-in, available at runtime
import { resolve, relative, isAbsolute } from 'node:path'

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspacePathError'
  }
}

/** True when absoluteCandidate resolves inside folderRoot (handles Windows cross-drive). */
export function isPathInsideWorkspaceRoot(folderRoot: string, absoluteCandidate: string): boolean {
  const root = resolve(folderRoot)
  const absolute = resolve(absoluteCandidate)
  const rel = relative(root, absolute)
  if (rel === '') return true
  // On Windows, relative() across drives returns an absolute path
  if (isAbsolute(rel)) return false
  if (rel.startsWith('..') || rel.split(/[\\/]/).includes('..')) return false
  return true
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

  if (!isPathInsideWorkspaceRoot(root, absolute)) {
    throw new WorkspacePathError('Path escapes workspace root')
  }

  return absolute
}

/** Return the workspace-relative path for an absolute path under folderRoot. */
export function toWorkspaceRelativePath(folderRoot: string, absolutePath: string): string {
  const root = resolve(folderRoot)
  const absolute = resolve(absolutePath)

  if (!isPathInsideWorkspaceRoot(root, absolute)) {
    throw new WorkspacePathError('Path escapes workspace root')
  }

  return relative(root, absolute).replace(/\\/g, '/')
}

/**
 * Resolve a path that is normally inside folderRoot, or allow external paths when gated by AgentGate.
 */
export function resolveWorkspaceOrExternalPath(
  folderRoot: string,
  inputPath: string,
  allowExternal = false
): {
  relativePath: string
  absolutePath: string
  isExternal: boolean
} {
  if (!allowExternal) {
    const relativePath = normalizeWorkspaceRelativePath(inputPath)
    const absolutePath = resolveWorkspacePath(folderRoot, relativePath)
    return { relativePath, absolutePath, isExternal: false }
  }

  if (inputPath == null || typeof inputPath !== 'string') {
    throw new WorkspacePathError('Path is required')
  }
  if (inputPath.includes('\0')) {
    throw new WorkspacePathError('Invalid path')
  }

  const trimmed = inputPath.trim()
  const root = resolve(folderRoot)
  if (trimmed === '' || trimmed === '.' || trimmed === './') {
    return { relativePath: '', absolutePath: root, isExternal: false }
  }

  const looksAbs = /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(trimmed)
  const absolutePath = looksAbs ? resolve(trimmed) : resolve(root, trimmed)

  if (isPathInsideWorkspaceRoot(root, absolutePath)) {
    const relativePath = toWorkspaceRelativePath(root, absolutePath)
    return { relativePath, absolutePath, isExternal: false }
  }

  return {
    relativePath: trimmed.replace(/\\/g, '/'),
    absolutePath,
    isExternal: true
  }
}
