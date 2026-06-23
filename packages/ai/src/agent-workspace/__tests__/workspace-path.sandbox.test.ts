import { describe, it, expect } from 'vitest'
import {
  normalizeWorkspaceRelativePath,
  resolveWorkspacePath,
  toWorkspaceRelativePath,
  WorkspacePathError
} from '../workspace-path.sandbox'
// @ts-ignore - Node built-in, available at runtime
import { join, resolve } from 'node:path'

const ROOT = resolve('/vault', 'workspace')

describe('workspace-path.sandbox', () => {
  it('normalizes backslashes and leading slashes', () => {
    expect(normalizeWorkspaceRelativePath('\\src\\app.ts')).toBe('src/app.ts')
    expect(normalizeWorkspaceRelativePath('/README.md')).toBe('README.md')
  })

  it('rejects parent traversal segments', () => {
    expect(() => normalizeWorkspaceRelativePath('../secret.txt')).toThrow(WorkspacePathError)
    expect(() => normalizeWorkspaceRelativePath('src/../../etc/passwd')).toThrow(WorkspacePathError)
  })

  it('resolves paths inside folderRoot', () => {
    const resolved = resolveWorkspacePath(ROOT, 'src/index.ts')
    expect(resolved).toBe(resolve(ROOT, 'src/index.ts'))
  })

  it('rejects absolute paths outside folderRoot', () => {
    expect(() => resolveWorkspacePath(ROOT, '../../../etc/passwd')).toThrow(WorkspacePathError)
  })

  it('converts absolute paths back to workspace-relative form', () => {
    const absolute = join(ROOT, 'notes', 'todo.md')
    expect(toWorkspaceRelativePath(ROOT, absolute)).toBe('notes/todo.md')
  })

  it('rejects null bytes in paths', () => {
    expect(() => normalizeWorkspaceRelativePath('bad\0path')).toThrow(WorkspacePathError)
  })
})
