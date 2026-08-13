import { beforeEach, describe, expect, it } from 'vitest'
// @ts-ignore - Node built-in, available at runtime
import { resolve } from 'node:path'
import { createInlineSnapshotStore } from '../inline-snapshot.store'
import type { WorkspaceFsAdapter } from '../workspace-fs'
import type { WorkspaceSnapshotStore } from '../workspace-snapshot-store'

function createMemoryFs(): WorkspaceFsAdapter & { files: Map<string, string> } {
  const files = new Map<string, string>()

  return {
    files,
    async exists(absolutePath: string) {
      return files.has(absolutePath)
    },
    async readFile(absolutePath: string) {
      return files.has(absolutePath) ? files.get(absolutePath)! : null
    },
    async writeFile(absolutePath: string, content: string) {
      files.set(absolutePath, content)
    },
    async deleteFile(absolutePath: string) {
      files.delete(absolutePath)
    },
    async rename(from: string, to: string) {
      const content = files.get(from)
      if (content == null) throw new Error('missing source')
      files.delete(from)
      files.set(to, content)
    },
    async listDir() {
      return []
    }
  }
}

const ROOT = resolve('/vault', 'notes')
const abs = (relativePath: string) => resolve(ROOT, relativePath)

describe('inline snapshot store', () => {
  let fs: ReturnType<typeof createMemoryFs>
  let store: WorkspaceSnapshotStore

  beforeEach(() => {
    fs = createMemoryFs()
    store = createInlineSnapshotStore(fs)
  })

  it('reports its kind so callers can tell capability apart', () => {
    expect(store.kind).toBe('inline')
  })

  it('captures existence, content and hash, de-duplicating paths', async () => {
    fs.files.set(abs('a.md'), 'hello')

    const handle = await store.capture({ folderRoot: ROOT, paths: ['a.md', 'a.md', 'missing.md'] })

    expect(handle.kind).toBe('inline')
    if (handle.kind !== 'inline') return
    expect(handle.files).toHaveLength(2)

    const existing = handle.files[0]!
    const missing = handle.files[1]!
    expect(existing).toMatchObject({ path: 'a.md', existed: true, beforeContent: 'hello' })
    expect(existing.beforeHash).toMatch(/^[0-9a-f]{64}$/)
    expect(missing).toMatchObject({ path: 'missing.md', existed: false })
    expect(missing.beforeContent).toBeUndefined()
  })

  it('keeps the first captured content when a path is extended twice', async () => {
    fs.files.set(abs('a.md'), 'first')
    const handle = await store.capture({ folderRoot: ROOT, paths: [] })

    await store.extend({ folderRoot: ROOT, handle, relativePath: 'a.md' })
    fs.files.set(abs('a.md'), 'second')
    await store.extend({ folderRoot: ROOT, handle, relativePath: 'a.md' })

    expect(store.listPaths(handle)).toEqual(['a.md'])
    if (handle.kind !== 'inline') return
    expect(handle.files[0]!.beforeContent).toBe('first')
  })

  it('restores modified files and deletes files created during the round', async () => {
    fs.files.set(abs('kept.md'), 'original')
    const handle = await store.capture({ folderRoot: ROOT, paths: ['kept.md', 'created.md'] })

    fs.files.set(abs('kept.md'), 'edited by agent')
    fs.files.set(abs('created.md'), 'brand new')

    const result = await store.restore({
      folderRoot: ROOT,
      handle,
      paths: ['kept.md', 'created.md']
    })

    expect(result.restored).toEqual(['kept.md'])
    expect(result.deleted).toEqual(['created.md'])
    expect(fs.files.get(abs('kept.md'))).toBe('original')
    expect(fs.files.has(abs('created.md'))).toBe(false)
  })

  it('skips instead of writing an empty file when captured content is missing', async () => {
    const handle = await store.capture({ folderRoot: ROOT, paths: [] })
    if (handle.kind !== 'inline') return
    handle.files.push({ path: 'unreadable.bin', existed: true })

    fs.files.set(abs('unreadable.bin'), 'agent output')
    const result = await store.restore({ folderRoot: ROOT, handle, paths: ['unreadable.bin'] })

    expect(result.skipped).toEqual(['unreadable.bin'])
    expect(fs.files.get(abs('unreadable.bin'))).toBe('agent output')
  })

  it('skips paths the snapshot never captured rather than deleting them', async () => {
    fs.files.set(abs('untouched.md'), 'user content')
    const handle = await store.capture({ folderRoot: ROOT, paths: [] })

    const result = await store.restore({ folderRoot: ROOT, handle, paths: ['untouched.md'] })

    expect(result).toEqual({ restored: [], deleted: [], skipped: ['untouched.md'] })
    expect(fs.files.get(abs('untouched.md'))).toBe('user content')
  })

  it('leaves captured paths outside the requested set untouched', async () => {
    fs.files.set(abs('a.md'), 'a')
    fs.files.set(abs('b.md'), 'b')
    const handle = await store.capture({ folderRoot: ROOT, paths: ['a.md', 'b.md'] })

    fs.files.set(abs('a.md'), 'a changed')
    fs.files.set(abs('b.md'), 'b changed')

    await store.restore({ folderRoot: ROOT, handle, paths: ['a.md'] })

    expect(fs.files.get(abs('a.md'))).toBe('a')
    expect(fs.files.get(abs('b.md'))).toBe('b changed')
  })

  it('cannot compute changed paths, so it reports null instead of guessing', async () => {
    const from = await store.capture({ folderRoot: ROOT, paths: [] })
    const to = await store.capture({ folderRoot: ROOT, paths: [] })

    await expect(store.diffPaths({ folderRoot: ROOT, from, to })).resolves.toBeNull()
  })

  it('degrades safely when handed a snapshot from another store kind', async () => {
    const foreign = { kind: 'git', treeOid: 'deadbeef' } as const

    expect(store.listPaths(foreign)).toBeNull()
    await expect(
      store.restore({ folderRoot: ROOT, handle: foreign, paths: ['a.md'] })
    ).resolves.toEqual({ restored: [], deleted: [], skipped: [] })
    await expect(
      store.extend({ folderRoot: ROOT, handle: foreign, relativePath: 'a.md' })
    ).resolves.toBe(foreign)
  })
})
