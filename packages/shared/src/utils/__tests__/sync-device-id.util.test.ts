import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveSyncDeviceId } from '../sync-device-id.util'

describe('resolveSyncDeviceId', () => {
  const syncMetaDir = '/root/.baishou'
  let files: Map<string, string>

  beforeEach(() => {
    files = new Map()
  })

  const storage = {
    exists: (path: string) => files.has(path),
    read: async (path: string) => files.get(path) || '',
    write: async (path: string, content: string) => {
      files.set(path, content)
    },
    mkdir: async () => {}
  }

  it('reuses persisted device id', async () => {
    files.set(`${syncMetaDir}/sync-device-id.txt`, 'desktop-abc')

    const id = await resolveSyncDeviceId('desktop', syncMetaDir, storage)
    expect(id).toBe('desktop-abc')
  })

  it('creates a new id when missing', async () => {
    const id = await resolveSyncDeviceId('mobile', syncMetaDir, storage)
    expect(id.startsWith('mobile-')).toBe(true)
    expect(files.get(`${syncMetaDir}/sync-device-id.txt`)).toBe(id)
  })

  it('regenerates when saved file is empty', async () => {
    files.set(`${syncMetaDir}/sync-device-id.txt`, '   ')
    const id = await resolveSyncDeviceId('desktop', syncMetaDir, storage)
    expect(id.startsWith('desktop-')).toBe(true)
    expect(id.trim()).not.toBe('')
  })
})
