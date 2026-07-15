import { describe, expect, it, vi } from 'vitest'

vi.mock('../mobile-http-transfer', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  uploadAsync: vi.fn()
}))

vi.mock('../mobile-incremental-cloud.client', () => ({
  MobileIncrementalCloudClient: class {
    setVaultPath() {}
    listFiles() {
      return Promise.resolve([])
    }
  }
}))

import {
  normalizeVaultConfig,
  projectIncrementalSyncRuntime
} from '../mobile-incremental-sync-config.util'

describe('mobile-incremental-sync-config isolation', () => {
  it('keeps S3 and WebDAV credentials isolated when switching target', () => {
    const saved = normalizeVaultConfig({
      target: 's3',
      s3AccessKey: 's3-ak',
      s3SecretKey: 's3-sk',
      s3Path: 's3_backup',
      webdavUsername: 'dav-user',
      webdavPassword: 'dav-pass',
      webdavPath: 'dav_backup',
      webdavUrl: 'https://dav.example.com'
    })

    expect(saved.accessKey).toBe('s3-ak')
    expect(saved.path).toBe('s3_backup')

    const asWebdav = projectIncrementalSyncRuntime({ ...saved, target: 'webdav' })
    expect(asWebdav.accessKey).toBe('dav-user')
    expect(asWebdav.secretKey).toBe('dav-pass')
    expect(asWebdav.path).toBe('dav_backup')
    expect(asWebdav.s3AccessKey).toBe('s3-ak')
    expect(asWebdav.webdavUsername).toBe('dav-user')

    const backToS3 = projectIncrementalSyncRuntime({ ...asWebdav, target: 's3' })
    expect(backToS3.accessKey).toBe('s3-ak')
    expect(backToS3.path).toBe('s3_backup')
    expect(backToS3.webdavUsername).toBe('dav-user')
  })

  it('hydrates legacy shared fields only into the active target side', () => {
    const legacyS3 = normalizeVaultConfig({
      target: 's3',
      accessKey: 'legacy-ak',
      secretKey: 'legacy-sk',
      path: 'legacy_path'
    })
    expect(legacyS3.s3AccessKey).toBe('legacy-ak')
    expect(legacyS3.webdavUsername).toBe('')
    expect(legacyS3.s3Path).toBe('legacy_path')

    const legacyDav = normalizeVaultConfig({
      target: 'webdav',
      accessKey: 'dav-legacy',
      secretKey: 'dav-secret',
      path: 'dav_legacy',
      webdavUrl: 'https://example.com'
    })
    expect(legacyDav.webdavUsername).toBe('dav-legacy')
    expect(legacyDav.s3AccessKey).toBe('')
    expect(legacyDav.webdavPath).toBe('dav_legacy')
  })
})
