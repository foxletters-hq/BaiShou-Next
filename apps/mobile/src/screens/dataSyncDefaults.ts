import type { SyncConfig } from '@baishou/core-mobile'

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  target: 'local',
  maxBackupCount: 20,
  maxSnapshotCount: 5,
  webdavUrl: 'https://',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: '/baishou_backup',
  s3Endpoint: 'https://',
  s3Region: '',
  s3Bucket: '',
  s3Path: '/baishou_backup',
  s3AccessKey: '',
  s3SecretKey: ''
}

/** 旧版 sync_targets 单项，用于一次性迁移 */
export interface LegacySyncTarget {
  id: string
  type: 'webdav' | 's3' | 'local'
  name: string
  url: string
  username?: string
  password?: string
  s3Bucket?: string
  s3Region?: string
  s3Path?: string
  isEnabled: boolean
}

export function migrateLegacySyncTargets(targets: LegacySyncTarget[]): SyncConfig | null {
  const active = targets.find((t) => t.isEnabled) ?? targets[0]
  if (!active) return null

  const base: SyncConfig = {
    ...DEFAULT_SYNC_CONFIG,
    target: active.type,
    maxBackupCount: 20,
    maxSnapshotCount: 5
  }

  if (active.type === 'webdav') {
    return {
      ...base,
      webdavUrl: active.url || DEFAULT_SYNC_CONFIG.webdavUrl,
      webdavUsername: active.username || '',
      webdavPassword: active.password || '',
      webdavPath: DEFAULT_SYNC_CONFIG.webdavPath
    }
  }

  if (active.type === 's3') {
    return {
      ...base,
      s3Endpoint: active.url || DEFAULT_SYNC_CONFIG.s3Endpoint,
      s3Region: active.s3Region || '',
      s3Bucket: active.s3Bucket || '',
      s3Path: active.s3Path || DEFAULT_SYNC_CONFIG.s3Path,
      s3AccessKey: active.username || '',
      s3SecretKey: active.password || ''
    }
  }

  return base
}
