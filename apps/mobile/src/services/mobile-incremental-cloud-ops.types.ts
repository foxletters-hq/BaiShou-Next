import type { IFileSystem } from '@baishou/core-mobile'
import type { S3SyncConfig } from '@baishou/shared'

export type TransferProgressCallback = (
  bytesDone: number,
  bytesTotal: number,
  filePath: string
) => void

export type TransferActivity = 'preparing' | 'reading' | 'uploading' | 'downloading' | 'writing'

export type TransferActivityCallback = (activity: TransferActivity, filePath: string) => void

export type IncrementalCloudOpsHost = {
  config: S3SyncConfig
  fileSystem: IFileSystem
  abortSignal?: AbortSignal
  transferProgressDestPath: string
  onTransferProgress?: TransferProgressCallback
  onTransferActivity?: TransferActivityCallback
  basePath(): string
  relFromLocal(localFilePath: string): string
  reportActivity(activity: TransferActivity, ioPath?: string): void
  reportTransfer(bytesDone: number, bytesTotal: number, ioPath?: string): void
  fetchWithAbort(url: string, init?: RequestInit): Promise<Response>
  transferWithAbort<T>(run: () => Promise<T>): Promise<T>
  signAndFetch(
    method: string,
    url: string,
    extraHeaders?: Record<string, string>
  ): Promise<Response>
  readFileChunk(localFilePath: string, position: number, length: number): Promise<ArrayBuffer>
  s3ObjectKey(rel: string): string
  s3UrlOptions(rel: string): {
    endpoint: string
    bucket: string
    objectKey: string
  }
  isSyncManifestRel(rel: string): boolean
  webdavAuth(): string
  webdavFileUrl(rel: string): string
  needsHttpStaging(localPath: string): boolean
  httpStagingPath(localPath: string, prefix: 'dl' | 'ul'): string
}

export type IncrementalSyncRecord = {
  filename: string
  lastModified: Date
  sizeInBytes: number
  managed: boolean
}

/** 超过此大小的文件走分片下载，以便 UI 有字节进度 */
export const MOBILE_SYNC_PROGRESS_CHUNK_THRESHOLD = 256 * 1024
/** 中等文件分片下载粒度（小于 S3 正式分片上限） */
export const MOBILE_SYNC_DOWNLOAD_PART_SIZE = 256 * 1024

export function mobileSyncDownloadPartSize(fileSize: number, chunkMax: number): number {
  if (fileSize <= MOBILE_SYNC_PROGRESS_CHUNK_THRESHOLD) return fileSize
  if (fileSize <= chunkMax) return MOBILE_SYNC_DOWNLOAD_PART_SIZE
  return chunkMax
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const step = 8192
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}
