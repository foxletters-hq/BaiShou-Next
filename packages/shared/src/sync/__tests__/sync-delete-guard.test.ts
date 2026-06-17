import { describe, expect, it } from 'vitest'
import type { SyncManifest } from '../../types/version-control.types'
import type { MergeDecision } from '../three-way-merge'
import {
  assertBidirectionalDeletePropagationAllowed,
  SyncDeletePropagationBlockedError
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

  it('blocks when current local scan lost most files vs previous local manifest', () => {
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
    ).toThrow(SyncDeletePropagationBlockedError)
  })
})
