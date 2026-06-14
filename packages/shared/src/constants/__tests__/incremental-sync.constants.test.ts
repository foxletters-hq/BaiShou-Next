import { describe, expect, it } from 'vitest'
import {
  SYNC_MANIFEST_FILENAME,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_MANIFEST_VERSION
} from '../incremental-sync.constants'

describe('incremental-sync.constants', () => {
  it('uses canonical manifest filenames for unreleased 1.0', () => {
    expect(SYNC_MANIFEST_FILENAME).toBe('manifest.json')
    expect(SYNC_REMOTE_SNAPSHOT_FILENAME).toBe('last-remote-manifest.json')
    expect(SYNC_MANIFEST_VERSION).toBe(1)
  })
})
