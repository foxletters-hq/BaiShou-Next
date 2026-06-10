import { describe, expect, it, vi } from 'vitest'
import type { IFileSystem } from '../../fs/file-system.types'
import {
  copyStorageRootContents,
  targetDirectoryHasData,
  validateStorageDirectoryWritable
} from '../storage-root-migration'

type FsState = {
  files: Map<string, string>
  dirs: Set<string>
}

function createMockFileSystem(initial?: { dirs?: string[]; files?: Record<string, string> }): {
  fs: IFileSystem
  state: FsState
} {
  const state: FsState = {
    files: new Map(Object.entries(initial?.files ?? {})),
    dirs: new Set(initial?.dirs ?? [])
  }

  const exists = async (p: string) => state.dirs.has(p) || state.files.has(p)

  const fs: IFileSystem = {
    exists,
    mkdir: async (p, opts) => {
      state.dirs.add(p)
      if (opts?.recursive) {
        const parts = p.split('/').filter(Boolean)
        let cur = ''
        for (const part of parts) {
          cur += `/${part}`
          state.dirs.add(cur)
        }
      }
    },
    writeFile: async (p, data) => {
      state.files.set(p, data)
    },
    readFile: async (p) => state.files.get(p) ?? '',
    copyFile: vi.fn(async (src, dest) => {
      if (state.dirs.has(src)) {
        state.dirs.add(dest)
        const prefix = `${src}/`
        for (const [path, content] of state.files) {
          if (path.startsWith(prefix)) {
            state.files.set(path.replace(src, dest), content)
          }
        }
        for (const dir of state.dirs) {
          if (dir.startsWith(prefix)) {
            state.dirs.add(dir.replace(src, dest))
          }
        }
        return
      }
      const content = state.files.get(src)
      if (content !== undefined) state.files.set(dest, content)
    }),
    unlink: async (p) => {
      state.files.delete(p)
      state.dirs.delete(p)
      const prefix = `${p}/`
      for (const key of [...state.files.keys()]) {
        if (key.startsWith(prefix)) state.files.delete(key)
      }
      for (const dir of [...state.dirs]) {
        if (dir.startsWith(prefix)) state.dirs.delete(dir)
      }
    },
    readdir: async (p) => {
      const prefix = `${p}/`
      const names = new Set<string>()
      for (const dir of state.dirs) {
        if (dir.startsWith(prefix)) {
          const rest = dir.slice(prefix.length)
          const first = rest.split('/')[0]
          if (first) names.add(first)
        }
      }
      for (const file of state.files.keys()) {
        if (file.startsWith(prefix)) {
          const rest = file.slice(prefix.length)
          if (!rest.includes('/')) names.add(rest)
        }
      }
      return [...names]
    },
    stat: async (p) => {
      if (state.dirs.has(p)) {
        return { isFile: false, isDirectory: true, size: 0, mtimeMs: 0 }
      }
      if (state.files.has(p)) {
        return { isFile: true, isDirectory: false, size: state.files.get(p)!.length, mtimeMs: 0 }
      }
      throw new Error('ENOENT')
    },
    rename: async (oldPath, newPath) => {
      if (state.files.has(oldPath)) {
        state.files.set(newPath, state.files.get(oldPath)!)
        state.files.delete(oldPath)
      }
      if (state.dirs.has(oldPath)) {
        state.dirs.delete(oldPath)
        state.dirs.add(newPath)
      }
    },
    rm: async (p, options) => {
      if (options?.recursive) {
        const prefix = `${p}/`
        for (const key of [...state.files.keys()]) {
          if (key.startsWith(prefix)) state.files.delete(key)
        }
        for (const dir of [...state.dirs]) {
          if (dir.startsWith(prefix)) state.dirs.delete(dir)
        }
      }
      state.files.delete(p)
      state.dirs.delete(p)
    }
  }

  return { fs, state }
}

describe('storage-root-migration', () => {
  it('copies source entries into target', async () => {
    const { fs } = createMockFileSystem({
      dirs: ['/src', '/src/Personal'],
      files: { '/src/vault_registry.json': '{}', '/src/Personal/note.md': 'hi' }
    })

    await fs.mkdir('/dest', { recursive: true })
    await copyStorageRootContents(fs, '/src', '/dest')

    expect(await fs.exists('/dest/Personal')).toBe(true)
    expect(await fs.exists('/dest/vault_registry.json')).toBe(true)
    expect(await fs.exists('/dest/.baishou_migrate_staging')).toBe(false)
  })

  it('rolls back promoted files when promotion fails', async () => {
    const { fs } = createMockFileSystem({
      dirs: ['/src', '/src/Personal', '/dest'],
      files: { '/src/vault_registry.json': '{}', '/src/Personal/note.md': 'hi' }
    })

    let promoteCalls = 0
    const originalCopy = fs.copyFile
    fs.copyFile = vi.fn(async (src, dest) => {
      promoteCalls += 1
      if (promoteCalls === 2) {
        throw new Error('DISK_FULL')
      }
      return originalCopy(src, dest)
    })

    await expect(copyStorageRootContents(fs, '/src', '/dest')).rejects.toThrow('DISK_FULL')
    expect(await fs.exists('/dest/Personal')).toBe(false)
    expect(await fs.exists('/dest/vault_registry.json')).toBe(false)
  })

  it('detects non-empty target ignoring staging artifacts', async () => {
    const { fs } = createMockFileSystem({
      dirs: ['/dest', '/dest/.baishou_migrate_staging'],
      files: { '/dest/.baishou_migrate_staging/tmp.txt': 'x' }
    })
    expect(await targetDirectoryHasData(fs, '/dest')).toBe(false)

    const { fs: fs2 } = createMockFileSystem({
      dirs: ['/dest2', '/dest2/Personal'],
      files: {}
    })
    expect(await targetDirectoryHasData(fs2, '/dest2')).toBe(true)
  })

  it('validates writable directory', async () => {
    const { fs } = createMockFileSystem({ dirs: ['/writable'] })
    expect(await validateStorageDirectoryWritable(fs, '/writable')).toBe(true)
  })
})
