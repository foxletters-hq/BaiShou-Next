import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createGitShadowSnapshotStore,
  GitShadowSnapshotError,
  type WorkspaceGitCommandResult
} from '../git-shadow-snapshot.store'
import type { GitShadowFs } from '../git-shadow-fs'
import type { WorkspaceSnapshotStore } from '../workspace-snapshot-store'

const FOLDER_ROOT = join('D:', 'notes')
const GIT_DIR = join('D:', 'appdata', 'shadow', 'notes')
const TREE_OID = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

function ok(stdout = ''): WorkspaceGitCommandResult {
  return { code: 0, stdout, stderr: '', timedOut: false }
}

function fail(stderr: string): WorkspaceGitCommandResult {
  return { code: 128, stdout: '', stderr, timedOut: false }
}

interface GitCall {
  subcommand: string
  args: string[]
  stdin?: string
}

function createFakeGit(handlers: Record<string, () => Promise<WorkspaceGitCommandResult>>) {
  const calls: GitCall[] = []

  const runGit = vi.fn(
    async (input: { args: string[]; stdin?: string }): Promise<WorkspaceGitCommandResult> => {
      const args = input.args.slice(4)
      const subcommand = args[0] ?? ''
      calls.push({ subcommand, args, stdin: input.stdin })
      const handler = handlers[subcommand]
      return handler ? handler() : ok()
    }
  )

  return { runGit, calls }
}

function createFakeShadowFs(options: { initialized?: boolean; sizes?: Record<string, number> } = {}) {
  const present = new Set<string>()
  const written = new Map<string, string>()
  const removed: string[] = []
  const copied: Array<[string, string]> = []

  if (options.initialized) present.add(join(GIT_DIR, 'HEAD'))

  const fs: GitShadowFs = {
    async ensureDir() {},
    async exists(absolutePath: string) {
      return present.has(absolutePath)
    },
    async fileSize(absolutePath: string) {
      return options.sizes?.[absolutePath] ?? 0
    },
    async removePath(absolutePath: string) {
      removed.push(absolutePath)
      present.delete(absolutePath)
    },
    async writeFile(absolutePath: string, content: string) {
      written.set(absolutePath, content)
      present.add(absolutePath)
    },
    async copyFile(from: string, to: string) {
      copied.push([from, to])
    }
  }

  return { fs, present, written, removed, copied }
}

function createStore(
  overrides: {
    handlers?: Record<string, () => Promise<WorkspaceGitCommandResult>>
    fs?: GitShadowFs
    maxUntrackedFileBytes?: number
    onWarn?: (message: string, detail?: Record<string, unknown>) => void
  } = {}
) {
  const { runGit, calls } = createFakeGit({
    'write-tree': async () => ok(`${TREE_OID}\n`),
    ...overrides.handlers
  })

  const store: WorkspaceSnapshotStore = createGitShadowSnapshotStore({
    runGit,
    resolveGitDir: () => GIT_DIR,
    fs: overrides.fs ?? createFakeShadowFs({ initialized: true }).fs,
    maxUntrackedFileBytes: overrides.maxUntrackedFileBytes,
    onWarn: overrides.onWarn
  })

  return { store, runGit, calls }
}

describe('git shadow snapshot store', () => {
  it('reports its kind and refuses to enumerate whole-tree paths', () => {
    const { store } = createStore()
    expect(store.kind).toBe('git')
    expect(store.listPaths({ kind: 'git', treeOid: TREE_OID })).toBeNull()
  })

  it('initializes the shadow repository once, with Windows-safe config', async () => {
    const shadow = createFakeShadowFs({ initialized: false })
    const { store, calls } = createStore({ fs: shadow.fs })

    await store.capture({ folderRoot: FOLDER_ROOT })

    expect(calls[0]?.subcommand).toBe('init')
    const configPairs = calls
      .filter((call) => call.subcommand === 'config')
      .map((call) => `${call.args[1]}=${call.args[2]}`)
    expect(configPairs).toContain('core.autocrlf=false')
    expect(configPairs).toContain('core.longpaths=true')
    expect(configPairs).toContain('gc.auto=0')

    expect(shadow.written.get(join(GIT_DIR, 'info', 'exclude'))).toContain('node_modules/')
  })

  it('never touches the user folder with a real .git directory', async () => {
    const shadow = createFakeShadowFs({ initialized: false })
    const { store, runGit } = createStore({ fs: shadow.fs })

    await store.capture({ folderRoot: FOLDER_ROOT })

    for (const call of runGit.mock.calls) {
      const args = call[0].args
      expect(args[0]).toBe('--git-dir')
      expect(args[1]).toBe(GIT_DIR)
      expect(args[2]).toBe('--work-tree')
      expect(args[3]).toBe(FOLDER_ROOT)
    }
    for (const path of shadow.written.keys()) {
      expect(path.startsWith(GIT_DIR)).toBe(true)
    }
  })

  it('skips init when the repository already exists', async () => {
    const { store, calls } = createStore()
    await store.capture({ folderRoot: FOLDER_ROOT })
    expect(calls.some((call) => call.subcommand === 'init')).toBe(false)
  })

  it('stages changed and untracked paths through stdin, then writes a tree', async () => {
    const { store, calls } = createStore({
      handlers: {
        'diff-files': async () => ok('changed.md\0'),
        'ls-files': async () => ok('新建/笔记.md\0')
      }
    })

    const handle = await store.capture({ folderRoot: FOLDER_ROOT })

    const add = calls.find((call) => call.subcommand === 'add')
    expect(add?.args).toContain('--pathspec-from-file=-')
    expect(add?.stdin).toBe('changed.md\0新建/笔记.md\0')
    expect(handle).toEqual({ kind: 'git', treeOid: TREE_OID })
  })

  it('does not stage anything when the working tree is clean', async () => {
    const { store, calls } = createStore()
    await store.capture({ folderRoot: FOLDER_ROOT })
    expect(calls.some((call) => call.subcommand === 'add')).toBe(false)
    expect(calls.some((call) => call.subcommand === 'write-tree')).toBe(true)
  })

  it('drops oversized untracked files from the snapshot and warns', async () => {
    const onWarn = vi.fn()
    const shadow = createFakeShadowFs({
      initialized: true,
      sizes: { [join(FOLDER_ROOT, 'huge.bin')]: 5_000_000 }
    })
    const { store, calls } = createStore({
      fs: shadow.fs,
      maxUntrackedFileBytes: 1_000_000,
      onWarn,
      handlers: {
        'diff-files': async () => ok(''),
        'ls-files': async () => ok('huge.bin\0small.md\0')
      }
    })

    await store.capture({ folderRoot: FOLDER_ROOT })

    expect(calls.find((call) => call.subcommand === 'rm')?.stdin).toBe('huge.bin\0')
    expect(calls.find((call) => call.subcommand === 'add')?.stdin).toBe('small.md\0')
    expect(onWarn).toHaveBeenCalledWith(
      'shadow snapshot: skipped oversized files',
      expect.objectContaining({ count: 1 })
    )
  })

  it('restores paths that exist in the tree', async () => {
    const { store, calls } = createStore({
      handlers: {
        'ls-tree': async () => ok('doc.md\0')
      }
    })

    const result = await store.restore({
      folderRoot: FOLDER_ROOT,
      handle: { kind: 'git', treeOid: TREE_OID },
      paths: ['doc.md']
    })

    const checkout = calls.find((call) => call.subcommand === 'checkout')
    expect(checkout?.args).toEqual(['checkout', TREE_OID, '--', 'doc.md'])
    expect(result).toEqual({ restored: ['doc.md'], deleted: [], skipped: [] })
  })

  it('deletes paths absent from the tree and drops them from the index', async () => {
    const shadow = createFakeShadowFs({ initialized: true })
    shadow.present.add(join(FOLDER_ROOT, 'created.md'))
    const { store, calls } = createStore({
      fs: shadow.fs,
      handlers: { 'ls-tree': async () => ok('') }
    })

    const result = await store.restore({
      folderRoot: FOLDER_ROOT,
      handle: { kind: 'git', treeOid: TREE_OID },
      paths: ['created.md']
    })

    expect(result).toEqual({ restored: [], deleted: ['created.md'], skipped: [] })
    expect(shadow.removed).toEqual([join(FOLDER_ROOT, 'created.md')])
    expect(calls.find((call) => call.subcommand === 'rm')?.stdin).toBe('created.md\0')
  })

  it('skips paths that are absent from both the tree and the disk', async () => {
    const { store } = createStore({ handlers: { 'ls-tree': async () => ok('') } })

    const result = await store.restore({
      folderRoot: FOLDER_ROOT,
      handle: { kind: 'git', treeOid: TREE_OID },
      paths: ['already-gone.md']
    })

    expect(result).toEqual({ restored: [], deleted: [], skipped: ['already-gone.md'] })
  })

  it('ignores a restore request with no paths instead of touching the tree', async () => {
    const { store, calls } = createStore()

    const result = await store.restore({
      folderRoot: FOLDER_ROOT,
      handle: { kind: 'git', treeOid: TREE_OID },
      paths: []
    })

    expect(result).toEqual({ restored: [], deleted: [], skipped: [] })
    expect(calls).toHaveLength(0)
  })

  it('reports changed paths between two trees, short-circuiting identical ones', async () => {
    const { store, calls } = createStore({
      handlers: { diff: async () => ok('a.md\0b/c.md\0') }
    })
    const from = { kind: 'git', treeOid: 'aaa' } as const
    const to = { kind: 'git', treeOid: 'bbb' } as const

    await expect(store.diffPaths({ folderRoot: FOLDER_ROOT, from, to })).resolves.toEqual([
      'a.md',
      'b/c.md'
    ])
    await expect(store.diffPaths({ folderRoot: FOLDER_ROOT, from, to: from })).resolves.toEqual([])
    expect(calls.filter((call) => call.subcommand === 'diff')).toHaveLength(1)
  })

  it('leaves the handle untouched when a path is reported mid-round', async () => {
    const { store, calls } = createStore()
    const handle = { kind: 'git', treeOid: TREE_OID } as const

    await expect(
      store.extend({ folderRoot: FOLDER_ROOT, handle, relativePath: 'a.md' })
    ).resolves.toBe(handle)
    expect(calls).toHaveLength(0)
  })

  it('surfaces git failures with stderr attached', async () => {
    const { store } = createStore({
      handlers: { 'write-tree': async () => fail('fatal: unable to write new index file') }
    })

    await expect(store.capture({ folderRoot: FOLDER_ROOT })).rejects.toBeInstanceOf(
      GitShadowSnapshotError
    )
    await store.capture({ folderRoot: FOLDER_ROOT }).catch((error: GitShadowSnapshotError) => {
      expect(error.stderr).toContain('unable to write new index file')
    })
  })

  it('serializes concurrent captures so two runs never share an index lock', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let writeTreeCount = 0

    const { store, calls } = createStore({
      handlers: {
        'write-tree': async () => {
          writeTreeCount += 1
          if (writeTreeCount === 1) await gate
          return ok(`${TREE_OID}\n`)
        }
      }
    })

    const first = store.capture({ folderRoot: FOLDER_ROOT })
    const second = store.capture({ folderRoot: FOLDER_ROOT })

    await vi.waitFor(() => expect(writeTreeCount).toBe(1))
    expect(calls.filter((call) => call.subcommand === 'write-tree')).toHaveLength(1)

    release?.()
    await Promise.all([first, second])
    expect(calls.filter((call) => call.subcommand === 'write-tree')).toHaveLength(2)
  })
})

describe('git shadow snapshot store with a foreign handle', () => {
  let store: WorkspaceSnapshotStore

  beforeEach(() => {
    store = createStore().store
  })

  it('refuses to restore from an inline snapshot', async () => {
    await expect(
      store.restore({
        folderRoot: FOLDER_ROOT,
        handle: { kind: 'inline', files: [] },
        paths: ['a.md']
      })
    ).resolves.toEqual({ restored: [], deleted: [], skipped: [] })
  })

  it('cannot diff against an inline snapshot', async () => {
    await expect(
      store.diffPaths({
        folderRoot: FOLDER_ROOT,
        from: { kind: 'inline', files: [] },
        to: { kind: 'git', treeOid: TREE_OID }
      })
    ).resolves.toBeNull()
  })
})
