import { describe, expect, it } from 'vitest'
import {
  countUnverifiedAncestorEntries,
  reconcileAncestorWithRemoteTruth
} from '../reconcile-ancestor-with-remote.util'
import type { SyncManifest } from '../../types/version-control.types'

function entry(hash: string) {
  return { hash, size: 1, lastModified: 1 }
}

describe('reconcileAncestorWithRemoteTruth', () => {
  it('保留远端仍存在的祖先条目', () => {
    const ancestor: SyncManifest = {
      version: 1,
      updatedAt: 1,
      deviceId: 'a',
      files: { 'V/Sessions/a.json': entry('1') }
    }
    const remote: SyncManifest = {
      version: 1,
      updatedAt: 2,
      deviceId: 'b',
      files: { 'V/Sessions/a.json': entry('1') }
    }
    const next = reconcileAncestorWithRemoteTruth(ancestor, remote)
    expect(next.files['V/Sessions/a.json']).toEqual(entry('1'))
    expect(countUnverifiedAncestorEntries(ancestor, remote)).toBe(0)
  })

  it('保留远端 tombstone 对应的祖先条目', () => {
    const ancestor: SyncManifest = {
      version: 1,
      updatedAt: 1,
      deviceId: 'a',
      files: { 'V/Sessions/gone.json': entry('1') }
    }
    const remote: SyncManifest = {
      version: 1,
      updatedAt: 2,
      deviceId: 'b',
      files: {},
      removed: {
        'V/Sessions/gone.json': { removedAt: 3, hash: '1', size: 1, deviceId: 'b' }
      }
    }
    const next = reconcileAncestorWithRemoteTruth(ancestor, remote)
    expect(next.files['V/Sessions/gone.json']).toEqual(entry('1'))
  })

  it('剥离远端既无文件也无 tombstone 的假祖先', () => {
    const ancestor: SyncManifest = {
      version: 1,
      updatedAt: 1,
      deviceId: 'a',
      files: {
        'V/Sessions/a.json': entry('1'),
        'V/Sessions/e.json': entry('2')
      }
    }
    const remote: SyncManifest = {
      version: 1,
      updatedAt: 2,
      deviceId: 'b',
      files: { 'V/Sessions/a.json': entry('1') }
    }
    expect(countUnverifiedAncestorEntries(ancestor, remote)).toBe(1)
    const next = reconcileAncestorWithRemoteTruth(ancestor, remote)
    expect(next.files['V/Sessions/a.json']).toEqual(entry('1'))
    expect(next.files['V/Sessions/e.json']).toBeUndefined()
  })
})
