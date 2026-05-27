export const CLOUD_SYNC_TARGETS = [
  { key: 'local', label: '本地' },
  { key: 'webdav', label: 'WebDAV' },
  { key: 's3', label: 'S3' }
] as const

export const formatCloudSyncSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
