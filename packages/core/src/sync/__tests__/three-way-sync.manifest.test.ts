import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { ThreeWaySyncService } from '../three-way-sync.service'
import {
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_MANIFEST_VERSION
} from '@baishou/shared'
import { SYNC_STORAGE_ID_FILENAME } from '@baishou/shared'
import type { ICloudSyncClient } from '../../network/cloud-sync.interface'
import type { IStoragePathService } from '../../vault/storage-path.types'

describe('ThreeWaySyncManifestMixin.getRemoteSnapshot', () => {
  let vaultPath: string
  let service: ThreeWaySyncService

  const cloudClient = {
    listFiles: vi.fn().mockResolvedValue([]),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn()
  } as unknown as ICloudSyncClient

  const pathService = {
    getActiveVaultPath: vi.fn()
  } as unknown as IStoragePathService

  beforeEach(() => {
    vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'baishou-sync-test-'))
    vi.mocked(pathService.getActiveVaultPath).mockResolvedValue(vaultPath)
    service = new ThreeWaySyncService(pathService, cloudClient, 'desktop-test')

    const baishouDir = path.join(vaultPath, '.baishou')
    fs.mkdirSync(baishouDir, { recursive: true })
    fs.writeFileSync(
      path.join(vaultPath, '.baishou-s3.json'),
      JSON.stringify({
        enabled: true,
        target: 's3',
        endpoint: 'https://s3.example.com',
        region: 'us-east-1',
        bucket: 'bucket-a',
        path: 'backup_sync',
        accessKey: 'ak',
        secretKey: 'sk'
      }),
      'utf8'
    )
  })

  afterEach(() => {
    fs.rmSync(vaultPath, { recursive: true, force: true })
  })

  it('returns empty ancestor when snapshot exists but storage id file is missing', async () => {
    const snapshot = {
      version: SYNC_MANIFEST_VERSION,
      updatedAt: 1,
      deviceId: 'old',
      files: { 'notes/a.md': { hash: 'abc', size: 1, lastModified: 1 } }
    }
    fs.writeFileSync(
      path.join(vaultPath, '.baishou', SYNC_REMOTE_SNAPSHOT_FILENAME),
      JSON.stringify(snapshot),
      'utf8'
    )

    const result = await service.getRemoteSnapshot()

    expect(result.files).toEqual({})
  })

  it('returns empty ancestor when storage id does not match current target', async () => {
    const snapshot = {
      version: SYNC_MANIFEST_VERSION,
      updatedAt: 1,
      deviceId: 'old',
      files: { 'notes/a.md': { hash: 'abc', size: 1, lastModified: 1 } }
    }
    const baishouDir = path.join(vaultPath, '.baishou')
    fs.writeFileSync(path.join(baishouDir, SYNC_REMOTE_SNAPSHOT_FILENAME), JSON.stringify(snapshot), 'utf8')
    fs.writeFileSync(path.join(baishouDir, SYNC_STORAGE_ID_FILENAME), 's3:other-bucket', 'utf8')

    const result = await service.getRemoteSnapshot()

    expect(result.files).toEqual({})
  })
})
