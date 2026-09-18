import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildRenamedWorkspaceRelativePath,
  listDirectoryEntries,
  normalizeWorkspaceRelativePath,
  resolveWithinRoot,
  stripUtf8Bom
} from '../agent-workspace-fs.util'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-fs-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('stripUtf8Bom', () => {
  it('should drop the leading mark when the text starts with a UTF-8 BOM', () => {
    expect(stripUtf8Bom('\uFEFFhello')).toBe('hello')
  })

  it('should keep the original text when there is no BOM', () => {
    expect(stripUtf8Bom('hello')).toBe('hello')
    expect(stripUtf8Bom('')).toBe('')
  })
})

describe('resolveWithinRoot', () => {
  it('should resolve a nested file when it stays inside the workspace root', () => {
    const root = path.resolve('/workspace-root')
    expect(resolveWithinRoot(root, 'src/a.ts')).toBe(path.resolve(root, 'src/a.ts'))
    expect(resolveWithinRoot(root, '')).toBe(path.resolve(root))
  })

  it('should throw when the relative path escapes the workspace root', () => {
    const root = path.resolve('/workspace-root')
    expect(() => resolveWithinRoot(root, '../outside.txt')).toThrow('Path escapes workspace root')
    expect(() => resolveWithinRoot(root, path.resolve('/other/abs.ts'))).toThrow(
      'Path escapes workspace root'
    )
  })
})

describe('normalizeWorkspaceRelativePath', () => {
  it('should strip leading slashes when normalizing a relative path', () => {
    expect(normalizeWorkspaceRelativePath('\\src\\a.ts')).toBe('src/a.ts')
    expect(normalizeWorkspaceRelativePath('/notes/')).toBe('notes/')
  })

  it('should trim the trailing slash when requested', () => {
    expect(normalizeWorkspaceRelativePath('/notes/', { trimTrailingSlash: true })).toBe('notes')
  })
})

describe('buildRenamedWorkspaceRelativePath', () => {
  it('should keep the parent directory when renaming a nested file', () => {
    expect(buildRenamedWorkspaceRelativePath('src/old.ts', 'new.ts')).toEqual({
      normalized: 'src/old.ts',
      nextRelative: 'src/new.ts',
      trimmedName: 'new.ts'
    })
  })

  it('should use only the file name when renaming at the workspace root', () => {
    expect(buildRenamedWorkspaceRelativePath('old.ts', ' /new.ts ')).toEqual({
      normalized: 'old.ts',
      nextRelative: 'new.ts',
      trimmedName: 'new.ts'
    })
  })
})

describe('listDirectoryEntries', () => {
  it('should hide vcs junk and sort directories first when listing a folder', async () => {
    const root = await makeTempDir()
    await fs.mkdir(path.join(root, '.git'))
    await fs.mkdir(path.join(root, 'src'))
    await fs.writeFile(path.join(root, 'z.txt'), 'z')
    await fs.writeFile(path.join(root, 'a.txt'), 'a')
    await fs.writeFile(path.join(root, '.env'), 'x')

    const entries = await listDirectoryEntries(root)
    expect(entries.map((entry) => entry.name)).toEqual(['src', '.env', 'a.txt', 'z.txt'])
    expect(entries[0]).toMatchObject({ name: 'src', isDirectory: true, relativePath: 'src' })
  })

  it('should throw when the target is not a directory', async () => {
    const root = await makeTempDir()
    await fs.writeFile(path.join(root, 'file.txt'), 'x')
    await expect(listDirectoryEntries(root, 'file.txt')).rejects.toThrow('Not a directory')
  })

  it('should skip a dangling symlink when listing a directory', async () => {
    const root = await makeTempDir()
    await fs.writeFile(path.join(root, 'ok.txt'), 'ok')
    try {
      await fs.symlink(path.join(root, 'missing'), path.join(root, 'broken'))
    } catch {
      const entries = await listDirectoryEntries(root)
      expect(entries.map((entry) => entry.name)).toEqual(['ok.txt'])
      return
    }
    const entries = await listDirectoryEntries(root)
    expect(entries.map((entry) => entry.name)).toEqual(['ok.txt'])
  })
})
