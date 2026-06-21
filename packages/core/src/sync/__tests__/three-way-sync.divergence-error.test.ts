import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SyncDivergenceExceededError,
  SyncDivergenceConfirmationRequiredError
} from '@baishou/shared'
import { ThreeWaySyncService } from '../three-way-sync.service'
import { S3SyncError } from '../sync.errors'
import type { ICloudSyncClient } from '../../network/cloud-sync.interface'
import type { IStoragePathService } from '../../vault/storage-path.types'

describe('ThreeWaySyncService divergence errors', () => {
  const cloudClient = {
    listFiles: vi.fn(),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn()
  } as unknown as ICloudSyncClient

  const pathService = {
    getActiveVaultPath: vi.fn().mockResolvedValue('/vault')
  } as unknown as IStoragePathService

  let service: ThreeWaySyncService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ThreeWaySyncService(pathService, cloudClient, 'desktop-test')
    vi.spyOn(service, 'buildLocalManifest').mockResolvedValue({
      version: 1,
      updatedAt: 1,
      deviceId: 'local',
      files: { 'a.txt': { hash: '1', size: 1, lastModified: 1 } }
    })
    vi.spyOn(service, 'getRemoteManifest').mockResolvedValue({
      version: 1,
      updatedAt: 1,
      deviceId: 'remote',
      files: { 'b.txt': { hash: '2', size: 1, lastModified: 1 } }
    })
    vi.spyOn(service, 'getRemoteSnapshot').mockResolvedValue({
      version: 1,
      updatedAt: 0,
      deviceId: '',
      files: {}
    })
    vi.spyOn(service, 'getLocalManifest').mockResolvedValue({
      version: 1,
      updatedAt: 0,
      deviceId: '',
      files: {}
    })
    vi.spyOn(service, 'getSyncStorageHistoryState').mockResolvedValue('match')
    vi.spyOn(ThreeWaySyncService.prototype as any, 'loadConfig').mockResolvedValue(undefined)
    Object.defineProperty(service, 'config', {
      value: {
        enabled: true,
        endpoint: '',
        region: '',
        bucket: '',
        path: 'backup_sync',
        accessKey: '',
        secretKey: '',
        maxDivergencePercent: 10
      },
      writable: true
    })
  })

  it('rethrows SyncDivergenceExceededError without wrapping as S3SyncError', async () => {
    await expect(service.sync()).rejects.toBeInstanceOf(SyncDivergenceExceededError)
    await expect(service.sync()).rejects.not.toBeInstanceOf(S3SyncError)
  })

  it('rethrows SyncDivergenceConfirmationRequiredError on first-sync high divergence', async () => {
    vi.spyOn(service, 'getSyncStorageHistoryState').mockResolvedValue('none')
    await expect(service.sync()).rejects.toBeInstanceOf(SyncDivergenceConfirmationRequiredError)
  })

  it('rethrows SyncDivergenceExceededError on downloadOnly', async () => {
    await expect(service.downloadOnly()).rejects.toBeInstanceOf(SyncDivergenceExceededError)
  })
})
