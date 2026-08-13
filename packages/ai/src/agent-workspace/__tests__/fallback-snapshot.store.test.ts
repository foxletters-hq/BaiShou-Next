import { describe, expect, it, vi } from 'vitest'
import { createFallbackSnapshotStore } from '../fallback-snapshot.store'
import type { WorkspaceSnapshotStore } from '../workspace-snapshot-store'

const GIT_HANDLE = { kind: 'git', treeOid: 'tree-1' } as const
const INLINE_HANDLE = { kind: 'inline', files: [] } as const

function createStubStore(kind: 'git' | 'inline'): WorkspaceSnapshotStore & {
  capture: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
  extend: ReturnType<typeof vi.fn>
  diffPaths: ReturnType<typeof vi.fn>
} {
  const handle = kind === 'git' ? GIT_HANDLE : INLINE_HANDLE
  return {
    kind,
    capture: vi.fn(async () => handle),
    extend: vi.fn(async () => handle),
    listPaths: () => (kind === 'inline' ? [] : null),
    restore: vi.fn(async () => ({ restored: [kind], deleted: [], skipped: [] })),
    diffPaths: vi.fn(async () => [kind])
  }
}

function setup() {
  const primary = createStubStore('git')
  const fallback = createStubStore('inline')
  const onDowngrade = vi.fn()
  const store = createFallbackSnapshotStore({ primary, fallback, onDowngrade })
  return { store, primary, fallback, onDowngrade }
}

describe('fallback snapshot store', () => {
  it('uses the primary store while it works', async () => {
    const { store, primary, fallback } = setup()

    await expect(store.capture({ folderRoot: '/notes' })).resolves.toEqual(GIT_HANDLE)
    expect(primary.capture).toHaveBeenCalledTimes(1)
    expect(fallback.capture).not.toHaveBeenCalled()
    expect(store.activeKindFor('/notes')).toBe('git')
  })

  it('falls back and reports the downgrade when the primary store fails', async () => {
    const { store, primary, fallback, onDowngrade } = setup()
    const failure = new Error('shadow repo unavailable')
    primary.capture.mockRejectedValueOnce(failure)

    await expect(store.capture({ folderRoot: '/notes' })).resolves.toEqual(INLINE_HANDLE)
    expect(fallback.capture).toHaveBeenCalledTimes(1)
    expect(onDowngrade).toHaveBeenCalledWith({ folderRoot: '/notes', error: failure })
    expect(store.activeKindFor('/notes')).toBe('inline')
  })

  it('stops retrying the primary store after a downgrade', async () => {
    const { store, primary, fallback } = setup()
    primary.capture.mockRejectedValueOnce(new Error('nope'))

    await store.capture({ folderRoot: '/notes' })
    await store.capture({ folderRoot: '/notes' })

    expect(primary.capture).toHaveBeenCalledTimes(1)
    expect(fallback.capture).toHaveBeenCalledTimes(2)
  })

  it('keeps the downgrade scoped to the folder that failed', async () => {
    const { store, primary } = setup()
    primary.capture.mockRejectedValueOnce(new Error('nope'))

    await store.capture({ folderRoot: '/broken' })
    await store.capture({ folderRoot: '/healthy' })

    expect(store.activeKindFor('/broken')).toBe('inline')
    expect(store.activeKindFor('/healthy')).toBe('git')
    expect(primary.capture).toHaveBeenCalledTimes(2)
  })

  it('still rolls back git snapshots taken before the downgrade', async () => {
    const { store, primary, fallback } = setup()
    primary.capture.mockRejectedValueOnce(new Error('nope'))
    await store.capture({ folderRoot: '/notes' })

    const result = await store.restore({
      folderRoot: '/notes',
      handle: GIT_HANDLE,
      paths: ['a.md']
    })

    expect(result.restored).toEqual(['git'])
    expect(primary.restore).toHaveBeenCalledTimes(1)
    expect(fallback.restore).not.toHaveBeenCalled()
  })

  it('routes extend and listPaths by the handle kind', async () => {
    const { store, primary, fallback } = setup()

    await store.extend({ folderRoot: '/notes', handle: INLINE_HANDLE, relativePath: 'a.md' })
    expect(fallback.extend).toHaveBeenCalledTimes(1)
    expect(primary.extend).not.toHaveBeenCalled()

    expect(store.listPaths(GIT_HANDLE)).toBeNull()
    expect(store.listPaths(INLINE_HANDLE)).toEqual([])
  })

  it('refuses to diff snapshots taken by different stores', async () => {
    const { store, primary } = setup()

    await expect(
      store.diffPaths({ folderRoot: '/notes', from: GIT_HANDLE, to: INLINE_HANDLE })
    ).resolves.toBeNull()
    expect(primary.diffPaths).not.toHaveBeenCalled()

    await expect(
      store.diffPaths({ folderRoot: '/notes', from: GIT_HANDLE, to: GIT_HANDLE })
    ).resolves.toEqual(['git'])
  })

  it('can retry the primary store once the downgrade is cleared', async () => {
    const { store, primary } = setup()
    primary.capture.mockRejectedValueOnce(new Error('nope'))

    await store.capture({ folderRoot: '/notes' })
    store.clearDowngrade('/notes')
    await store.capture({ folderRoot: '/notes' })

    expect(store.activeKindFor('/notes')).toBe('git')
    expect(primary.capture).toHaveBeenCalledTimes(2)
  })
})
