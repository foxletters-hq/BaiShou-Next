import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { pruneShadowSnapshotObjects } from '../git-shadow-gc'
import type { KeyedMutex } from '../keyed-mutex'
import type { WorkspaceGitCommandResult } from '../git-shadow-snapshot.store'

const FOLDER_ROOT = join('D:', 'notes')
const GIT_DIR = join('D:', 'appdata', 'shadow', 'notes')
const LIVE_OID = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const DEAD_OID = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

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

function createFakeGit(handlers: Record<string, () => WorkspaceGitCommandResult>) {
  const calls: GitCall[] = []

  const runGit = vi.fn(
    async (input: { args: string[]; stdin?: string }): Promise<WorkspaceGitCommandResult> => {
      // 前四个参数固定是 --git-dir <dir> --work-tree <root>
      const args = input.args.slice(4)
      const subcommand = args[0] ?? ''
      calls.push({ subcommand, args, stdin: input.stdin })
      return handlers[subcommand]?.() ?? ok()
    }
  )

  return { runGit, calls }
}

function prune(runGit: ReturnType<typeof createFakeGit>['runGit'], liveTreeOids: string[]) {
  return pruneShadowSnapshotObjects({
    runGit,
    gitDir: GIT_DIR,
    folderRoot: FOLDER_ROOT,
    liveTreeOids
  })
}

describe('pruneShadowSnapshotObjects', () => {
  it('releases refs whose checkpoint is gone and keeps the live ones', async () => {
    const { runGit, calls } = createFakeGit({
      'for-each-ref': () => ok(`refs/snapshots/${LIVE_OID}\nrefs/snapshots/${DEAD_OID}\n`)
    })

    const result = await prune(runGit, [LIVE_OID])

    expect(result).toEqual({ releasedRefs: 1, collected: true })
    const updates = calls.filter((call) => call.subcommand === 'update-ref')
    expect(updates).toHaveLength(1)
    expect(updates[0]?.stdin).toBe(`delete refs/snapshots/${DEAD_OID}\n`)
    expect(calls.at(-1)?.args).toEqual(['gc', '--prune=now', '--quiet'])
  })

  it('re-anchors live snapshots that lost their ref before collecting', async () => {
    const { runGit, calls } = createFakeGit({
      'for-each-ref': () => ok('')
    })

    const result = await prune(runGit, [LIVE_OID])

    expect(result.collected).toBe(true)
    const updates = calls.filter((call) => call.subcommand === 'update-ref')
    expect(updates[0]?.stdin).toBe(`update refs/snapshots/${LIVE_OID} ${LIVE_OID}\n`)
  })

  it('skips collection when a live snapshot cannot be re-anchored', async () => {
    const { runGit, calls } = createFakeGit({
      'for-each-ref': () => ok(`refs/snapshots/${DEAD_OID}\n`),
      'update-ref': () => fail('fatal: update_ref failed: missing object')
    })

    const result = await prune(runGit, [LIVE_OID])

    expect(result).toEqual({ releasedRefs: 0, collected: false })
    expect(calls.some((call) => call.subcommand === 'gc')).toBe(false)
  })

  it('skips collection when the ref listing itself fails', async () => {
    const { runGit, calls } = createFakeGit({
      'for-each-ref': () => fail('fatal: not a git repository')
    })

    const result = await prune(runGit, [LIVE_OID])

    expect(result).toEqual({ releasedRefs: 0, collected: false })
    expect(calls.some((call) => call.subcommand === 'gc')).toBe(false)
  })

  it('does not touch refs when the live set already matches', async () => {
    const { runGit, calls } = createFakeGit({
      'for-each-ref': () => ok(`refs/snapshots/${LIVE_OID}\n`)
    })

    const result = await prune(runGit, [LIVE_OID])

    expect(result).toEqual({ releasedRefs: 0, collected: true })
    expect(calls.some((call) => call.subcommand === 'update-ref')).toBe(false)
  })

  it('reports the gc failure instead of pretending the space was reclaimed', async () => {
    const { runGit } = createFakeGit({
      'for-each-ref': () => ok(`refs/snapshots/${DEAD_OID}\n`),
      gc: () => fail('fatal: gc is already running')
    })

    const result = await prune(runGit, [])

    expect(result).toEqual({ releasedRefs: 1, collected: false })
  })

  it('serializes against the snapshot store through the shared mutex', async () => {
    const order: string[] = []
    const mutex = {
      run: vi.fn(async <T>(key: string, task: () => Promise<T>): Promise<T> => {
        order.push(`lock:${key}`)
        const value = await task()
        order.push(`unlock:${key}`)
        return value
      })
    }
    const { runGit } = createFakeGit({ 'for-each-ref': () => ok('') })

    await pruneShadowSnapshotObjects({
      runGit,
      gitDir: GIT_DIR,
      folderRoot: FOLDER_ROOT,
      liveTreeOids: [],
      mutex: mutex as KeyedMutex
    })

    expect(order).toEqual([`lock:${GIT_DIR}`, `unlock:${GIT_DIR}`])
  })
})
