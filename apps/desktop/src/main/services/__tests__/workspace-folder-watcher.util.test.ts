import * as path from 'path'
import { describe, expect, it } from 'vitest'
import {
  canStartWorkspaceFolderWatch,
  evaluateWorkspaceWatchTarget,
  isFilesystemRootPath,
  isRegisteredWorkspaceFolder,
  mapWatchEventToKind,
  shouldIgnoreWorkspaceWatchPath,
  toWorkspaceRelativePath
} from '../workspace-folder-watcher.util'

const fixtureRoot = path.join(process.cwd(), '__watch_proj__')
const fixtureOther = path.join(process.cwd(), '__watch_other__')

describe('toWorkspaceRelativePath', () => {
  it('should return a posix relative path when the file is inside the folder', () => {
    const file = path.join(fixtureRoot, 'src', 'lib', 'a.ts')
    expect(toWorkspaceRelativePath(fixtureRoot, file)).toBe('src/lib/a.ts')
  })

  it('should return null when the file escapes the folder', () => {
    expect(toWorkspaceRelativePath(fixtureRoot, path.join(fixtureOther, 'a.ts'))).toBeNull()
  })

  it('should return an empty string when the path is the folder itself', () => {
    expect(toWorkspaceRelativePath(fixtureRoot, fixtureRoot)).toBe('')
  })
})

describe('shouldIgnoreWorkspaceWatchPath', () => {
  it('should ignore version-control and node_modules segments inside the workspace', () => {
    expect(shouldIgnoreWorkspaceWatchPath(fixtureRoot, path.join(fixtureRoot, '.git', 'HEAD'))).toBe(
      true
    )
    expect(
      shouldIgnoreWorkspaceWatchPath(
        fixtureRoot,
        path.join(fixtureRoot, 'node_modules', 'pkg', 'index.js')
      )
    ).toBe(true)
    expect(shouldIgnoreWorkspaceWatchPath(fixtureRoot, path.join(fixtureRoot, '.DS_Store'))).toBe(
      true
    )
  })

  it('should keep ordinary files and listed dotfiles', () => {
    expect(shouldIgnoreWorkspaceWatchPath(fixtureRoot, path.join(fixtureRoot, 'src', 'a.ts'))).toBe(
      false
    )
    expect(shouldIgnoreWorkspaceWatchPath(fixtureRoot, path.join(fixtureRoot, '.env'))).toBe(false)
    expect(
      shouldIgnoreWorkspaceWatchPath(fixtureRoot, path.join(fixtureRoot, '.github', 'ci.yml'))
    ).toBe(false)
  })

  it('should not ignore files just because an ancestor of the workspace is node_modules', () => {
    const nestedRoot = path.join(process.cwd(), 'node_modules', 'pkg-src')
    expect(shouldIgnoreWorkspaceWatchPath(nestedRoot, path.join(nestedRoot, 'src', 'a.ts'))).toBe(
      false
    )
    expect(
      shouldIgnoreWorkspaceWatchPath(nestedRoot, path.join(nestedRoot, 'node_modules', 'dep', 'x.js'))
    ).toBe(true)
  })
})

describe('evaluateWorkspaceWatchTarget', () => {
  it('should reject a filesystem root even if it exists', () => {
    const root = path.parse(process.cwd()).root
    expect(isFilesystemRootPath(root)).toBe(true)
    expect(evaluateWorkspaceWatchTarget(root, { exists: true, isDirectory: true })).toBe(
      'filesystem-root'
    )
    expect(isFilesystemRootPath(path.join(root, 'Users'))).toBe(false)
  })

  it('should reject a missing path or a file', () => {
    expect(evaluateWorkspaceWatchTarget(fixtureRoot, { exists: false, isDirectory: false })).toBe(
      'missing'
    )
    expect(evaluateWorkspaceWatchTarget(fixtureRoot, { exists: true, isDirectory: false })).toBe(
      'not-directory'
    )
    expect(evaluateWorkspaceWatchTarget(fixtureRoot, { exists: true, isDirectory: true })).toBe('ok')
  })
})

describe('canStartWorkspaceFolderWatch', () => {
  const presentDir = { exists: true, isDirectory: true }

  it('should allow a registered existing directory', () => {
    expect(
      canStartWorkspaceFolderWatch({
        folderRoot: fixtureRoot,
        stat: presentDir,
        workspaces: [{ folderRoot: fixtureRoot }]
      })
    ).toBe(true)
  })

  it('should reject an unregistered directory', () => {
    expect(
      canStartWorkspaceFolderWatch({
        folderRoot: fixtureRoot,
        stat: presentDir,
        workspaces: [{ folderRoot: fixtureOther }]
      })
    ).toBe(false)
  })

  it('should match registered folders with different slash casing', () => {
    expect(
      isRegisteredWorkspaceFolder(fixtureRoot.replace(/\\/g, '/'), [
        { folderRoot: fixtureRoot }
      ])
    ).toBe(true)
  })
})

describe('mapWatchEventToKind', () => {
  it('should map add and directory add to create', () => {
    expect(mapWatchEventToKind('add')).toBe('create')
    expect(mapWatchEventToKind('addDir')).toBe('create')
  })

  it('should map change to modify and unlink to delete', () => {
    expect(mapWatchEventToKind('change')).toBe('modify')
    expect(mapWatchEventToKind('unlink')).toBe('delete')
    expect(mapWatchEventToKind('unlinkDir')).toBe('delete')
  })

  it('should return null for events the tree does not need', () => {
    expect(mapWatchEventToKind('ready')).toBeNull()
    expect(mapWatchEventToKind('error')).toBeNull()
  })
})
