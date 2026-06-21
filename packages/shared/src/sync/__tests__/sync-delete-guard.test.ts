import { describe, expect, it } from 'vitest'
import type { SyncManifest } from '../../types/version-control.types'
import type { MergeDecision } from '../three-way-merge'
import {
  assertBidirectionalDeletePropagationAllowed,
  resolveSyncMergeDecisions,
  SyncDeletePropagationBlockedError,
  SyncDeletePropagationChoiceRequiredError
} from '../sync-delete-guard'
import { threeWayMerge } from '../three-way-merge'

function manifest(files: Record<string, string>): SyncManifest {
  return {
    version: 1,
    updatedAt: 0,
    deviceId: 'd',
    files: Object.fromEntries(
      Object.entries(files).map(([path, hash]) => [path, { hash, size: 1, lastModified: 0 }])
    )
  }
}

function deleteRemoteDecision(filePath: string): MergeDecision {
  const entry = { hash: 'h', size: 1, lastModified: 0 }
  return {
    filePath,
    type: 'delete-remote',
    hash: entry.hash,
    size: entry.size,
    localEntry: null,
    remoteEntry: entry,
    ancestorEntry: entry
  }
}

function deleteLocalDecision(filePath: string, hash = 'h'): MergeDecision {
  const entry = { hash, size: 1, lastModified: 0 }
  return {
    filePath,
    type: 'delete-local',
    hash: entry.hash,
    size: entry.size,
    localEntry: entry,
    remoteEntry: null,
    ancestorEntry: entry
  }
}

describe('assertBidirectionalDeletePropagationAllowed', () => {
  it('allows a small number of delete-remote decisions', () => {
    const remoteFiles = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`file-${i}.md`, `hash-${i}`])
    )
    const local = manifest({
      'file-0.md': 'hash-0',
      'file-1.md': 'hash-1',
      'file-2.md': 'hash-2',
      'file-3.md': 'hash-3',
      'file-4.md': 'hash-4',
      'file-5.md': 'hash-5',
      'file-6.md': 'hash-6',
      'file-7.md': 'hash-7'
    })
    const remote = manifest(remoteFiles)
    const ancestor = remote
    const decisions = threeWayMerge(local, remote, ancestor)

    expect(decisions.filter((d) => d.type === 'delete-remote')).toHaveLength(2)
    expect(() =>
      assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor)
    ).not.toThrow()
  })

  it('blocks mass delete-remote when local is empty but remote/ancestor are full', () => {
    const remoteFiles = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`file-${i}.md`, `hash-${i}`])
    )
    const local = manifest({})
    const remote = manifest(remoteFiles)
    const ancestor = remote
    const decisions = threeWayMerge(local, remote, ancestor)

    expect(decisions.filter((d) => d.type === 'delete-remote')).toHaveLength(20)
    expect(() =>
      assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor)
    ).toThrow(SyncDeletePropagationBlockedError)
  })

  it('allows delete-remote when local lost files intentionally vs previous local manifest', () => {
    const remoteFiles = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`file-${i}.md`, `hash-${i}`])
    )
    const previousLocal = manifest(remoteFiles)
    const local = manifest({ 'file-0.md': 'hash-0' })
    const remote = manifest(remoteFiles)
    const ancestor = remote
    const decisions = Array.from({ length: 9 }, (_, i) => deleteRemoteDecision(`file-${i + 1}.md`))

    expect(() =>
      assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor, previousLocal)
    ).not.toThrow()
  })

  it('blocks mass delete-local when remote is empty but local/ancestor are full', () => {
    const localFiles = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`file-${i}.md`, `hash-${i}`])
    )
    const local = manifest(localFiles)
    const remote = manifest({})
    const ancestor = manifest(localFiles)
    const decisions = threeWayMerge(local, remote, ancestor)

    expect(decisions.filter((d) => d.type === 'delete-local')).toHaveLength(20)
    expect(() =>
      assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor)
    ).toThrow(SyncDeletePropagationBlockedError)
  })

  it('blocks delete-local when remote lost most files vs ancestor snapshot without peer sync', () => {
    const ancestorFiles = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`file-${i}.md`, `hash-${i}`])
    )
    const local = manifest(ancestorFiles)
    const remote = manifest({ 'file-0.md': 'hash-0' })
    const ancestor = manifest(ancestorFiles)
    const decisions = Array.from({ length: 9 }, (_, i) =>
      deleteLocalDecision(`file-${i + 1}.md`, `hash-${i + 1}`)
    )

    expect(() =>
      assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor)
    ).toThrow(SyncDeletePropagationBlockedError)
  })

  it('allows mass delete-local when peer synced deletions after our ancestor snapshot', () => {
    const ancestorFiles = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`img-${i}.jpg`, `hash-${i}`])
    )
    const local = manifest(ancestorFiles)
    const remote = manifest(
      Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [`img-${i}.jpg`, `hash-${i}`])
      )
    )
    remote.updatedAt = 2_000
    const ancestor = manifest(ancestorFiles)
    ancestor.updatedAt = 1_000
    const decisions = Array.from({ length: 25 }, (_, i) =>
      deleteLocalDecision(`img-${i + 5}.jpg`, `hash-${i + 5}`)
    )

    expect(() =>
      assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor)
    ).not.toThrow()
  })

  it('allows mass delete-remote when local user deleted many unchanged remote files', () => {
    const remoteFiles = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`img-${i}.jpg`, `hash-${i}`])
    )
    const local = manifest(
      Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [`img-${i}.jpg`, `hash-${i}`])
      )
    )
    const remote = manifest(remoteFiles)
    const ancestor = manifest(remoteFiles)
    const decisions = threeWayMerge(local, remote, ancestor)

    expect(decisions.filter((d) => d.type === 'delete-remote')).toHaveLength(25)
    expect(() =>
      assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor)
    ).not.toThrow()
  })

  it('allows a few delete-local when remote shrank but not below ancestor ratio threshold', () => {
    const ancestorFiles = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`file-${i}.md`, `hash-${i}`])
    )
    const local = manifest(ancestorFiles)
    const remote = manifest({
      'file-0.md': 'hash-0',
      'file-1.md': 'hash-1',
      'file-2.md': 'hash-2',
      'file-3.md': 'hash-3'
    })
    const ancestor = manifest(ancestorFiles)
    const decisions = Array.from({ length: 2 }, (_, i) =>
      deleteLocalDecision(`file-${i + 8}.md`, `hash-${i + 8}`)
    )

    expect(() =>
      assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor)
    ).not.toThrow()
  })

  it('resolveSyncMergeDecisions requires user choice when propagation is blocked', () => {
    const remoteFiles = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`file-${i}.md`, `hash-${i}`])
    )
    const local = manifest({})
    const remote = manifest(remoteFiles)
    const ancestor = remote
    const decisions = threeWayMerge(local, remote, ancestor)

    expect(() => resolveSyncMergeDecisions(decisions, local, remote, ancestor)).toThrow(
      SyncDeletePropagationChoiceRequiredError
    )

    const skipped = resolveSyncMergeDecisions(decisions, local, remote, ancestor, undefined, {
      deletePropagationChoice: 'skip-deletes'
    })
    expect(skipped.some((d) => d.type === 'delete-remote' || d.type === 'delete-local')).toBe(false)
  })
})
