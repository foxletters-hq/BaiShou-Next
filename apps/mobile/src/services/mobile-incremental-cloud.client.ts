import type { IFileSystem } from '@baishou/core-mobile'
import {
  buildS3ObjectUrl,
  buildWebDavFileUrl,
  normalizeS3BasePath,
  s3FetchHeaders,
  signS3Request,
  SYNC_MANIFEST_FILENAME,
  type S3SyncConfig
} from '@baishou/shared'
import { isExternalStoragePath } from './android-external-fs'
import { getAppCacheDirectory } from './mobile-app-paths'
import { readSyncFileChunk } from './mobile-sync-file-read.util'
import {
  raceWithIncrementalSyncAbort,
  throwIfIncrementalSyncAborted,
  isIncrementalSyncAbortedError
} from './mobile-incremental-sync-abort.util'
import {
  isTransientNetworkError,
  withTransientNetworkRetry as withSharedTransientNetworkRetry
} from '../utils/transient-network-error.util'
import type {
  IncrementalCloudOpsHost,
  IncrementalSyncRecord,
  TransferActivity,
  TransferActivityCallback,
  TransferProgressCallback
} from './mobile-incremental-cloud-ops.types'
export type {
  IncrementalSyncRecord,
  TransferActivity,
  TransferActivityCallback,
  TransferProgressCallback
} from './mobile-incremental-cloud-ops.types'
import { listS3 } from './mobile-incremental-cloud-s3-list.ops'
import { uploadS3 } from './mobile-incremental-cloud-s3-upload.ops'
import { downloadS3 } from './mobile-incremental-cloud-s3-download.ops'
import { downloadWebDav, listWebDav, uploadWebDav } from './mobile-incremental-cloud-webdav.ops'

async function withTransientNetworkRetry<T>(
  run: () => Promise<T>,
  retries = 4,
  signal?: AbortSignal
): Promise<T> {
  return withSharedTransientNetworkRetry(
    async () => {
      throwIfIncrementalSyncAborted(signal)
      return run()
    },
    {
      retries,
      shouldRetry: (error) => {
        if (isIncrementalSyncAbortedError(error)) return false
        return isTransientNetworkError(error)
      }
    }
  )
}

/** 增量同步用云客户端（S3 / WebDAV），保留 vault 相对路径 */
export class MobileIncrementalCloudClient implements IncrementalCloudOpsHost {
  config: S3SyncConfig
  fileSystem: IFileSystem
  abortSignal?: AbortSignal
  onTransferProgress?: TransferProgressCallback
  onTransferActivity?: TransferActivityCallback
  transferProgressDestPath = ''

  constructor(config: S3SyncConfig, fileSystem: IFileSystem) {
    this.config = config
    this.fileSystem = fileSystem
  }

  private vaultPath: string | null = null

  setVaultPath(vaultPath: string) {
    this.vaultPath = vaultPath
  }

  setAbortSignal(signal?: AbortSignal) {
    this.abortSignal = signal
  }

  setTransferProgressCallback(callback?: TransferProgressCallback) {
    this.onTransferProgress = callback
  }

  setTransferActivityCallback(callback?: TransferActivityCallback) {
    this.onTransferActivity = callback
  }

  reportActivity(activity: TransferActivity, ioPath?: string) {
    const key = this.transferProgressDestPath || ioPath
    if (!key) return
    this.onTransferActivity?.(activity, key)
  }

  reportTransfer(bytesDone: number, bytesTotal: number, ioPath?: string) {
    const key = this.transferProgressDestPath || ioPath
    if (!key || bytesTotal <= 0) return
    this.onTransferProgress?.(bytesDone, bytesTotal, key)
  }

  async fetchWithAbort(url: string, init?: RequestInit): Promise<Response> {
    throwIfIncrementalSyncAborted(this.abortSignal)
    return fetch(url, { ...init, signal: this.abortSignal })
  }

  async transferWithAbort<T>(run: () => Promise<T>): Promise<T> {
    return raceWithIncrementalSyncAbort(this.abortSignal, run())
  }

  basePath(): string {
    return normalizeS3BasePath(this.config.path)
  }

  async signAndFetch(
    method: string,
    url: string,
    extraHeaders?: Record<string, string>
  ): Promise<Response> {
    const signed = await signS3Request(
      method,
      url,
      this.config.region || 'us-east-1',
      this.config.accessKey || '',
      this.config.secretKey || '',
      null,
      extraHeaders
    )
    return this.fetchWithAbort(url, { method, headers: s3FetchHeaders(signed) })
  }

  relFromLocal(localFilePath: string): string {
    if (this.vaultPath) {
      const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/$/, '')
      const base = norm(this.vaultPath)
      const full = norm(localFilePath)
      if (full.startsWith(base + '/')) {
        return full.slice(base.length + 1)
      }
    }
    const parts = localFilePath.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || localFilePath
  }

  needsHttpStaging(localPath: string): boolean {
    return isExternalStoragePath(localPath)
  }

  httpStagingPath(localPath: string, prefix: 'dl' | 'ul'): string {
    const name = localPath.replace(/\\/g, '/').split('/').pop() || 'file'
    return `${getAppCacheDirectory()}sync_${prefix}_${Date.now()}_${name}`
  }

  s3ObjectKey(rel: string): string {
    return this.basePath() + rel
  }

  isSyncManifestRel(rel: string): boolean {
    return (
      rel === SYNC_MANIFEST_FILENAME ||
      rel.endsWith(`/${SYNC_MANIFEST_FILENAME}`) ||
      rel.endsWith(`.baishou/${SYNC_MANIFEST_FILENAME}`)
    )
  }

  s3UrlOptions(rel: string) {
    return {
      endpoint: this.config.endpoint || '',
      bucket: this.config.bucket || '',
      objectKey: this.s3ObjectKey(rel)
    }
  }

  async readFileChunk(
    localFilePath: string,
    position: number,
    length: number
  ): Promise<ArrayBuffer> {
    return readSyncFileChunk(localFilePath, position, length)
  }

  webdavAuth(): string {
    return `Basic ${btoa(`${this.config.accessKey}:${this.config.secretKey}`)}`
  }

  webdavFileUrl(rel: string): string {
    return buildWebDavFileUrl(this.config.webdavUrl, this.basePath(), rel)
  }

  async uploadFile(localFilePath: string, remoteRelPath?: string): Promise<void> {
    const rel = remoteRelPath?.replace(/\\/g, '/') ?? this.relFromLocal(localFilePath)
    await withTransientNetworkRetry(
      async () => {
        if (this.config.target === 'webdav') {
          await uploadWebDav(this, rel, localFilePath)
        } else {
          await uploadS3(this, rel, localFilePath)
        }
      },
      4,
      this.abortSignal
    )
  }

  async downloadFile(
    remoteFilename: string,
    localDestPath: string,
    knownSize?: number
  ): Promise<void> {
    this.transferProgressDestPath = localDestPath
    try {
      await withTransientNetworkRetry(
        async () => {
          const parent = localDestPath.replace(/\/[^/]+$/, '')
          if (!(await this.fileSystem.exists(parent))) {
            await this.fileSystem.mkdir(parent, { recursive: true })
          }

          const staged = this.needsHttpStaging(localDestPath)
            ? this.httpStagingPath(localDestPath, 'dl')
            : localDestPath

          if (this.config.target === 'webdav') {
            await downloadWebDav(this, remoteFilename, staged, localDestPath)
          } else {
            await downloadS3(this, remoteFilename, staged, localDestPath, knownSize)
          }

          if (staged !== localDestPath) {
            this.reportActivity('writing', localDestPath)
            this.reportTransfer(0, 1, localDestPath)
            await this.fileSystem.copyFile(staged, localDestPath)
            await this.fileSystem.unlink(staged).catch(() => {})
            const stat = await this.fileSystem.stat(localDestPath).catch(() => null)
            const size = stat?.size ?? 0
            if (size > 0) this.reportTransfer(size, size, localDestPath)
          }
        },
        4,
        this.abortSignal
      )
    } finally {
      this.transferProgressDestPath = ''
    }
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    if (this.config.target === 'webdav') {
      const auth = this.webdavAuth()
      const res = await this.fetchWithAbort(this.webdavFileUrl(remoteFilename), {
        method: 'DELETE',
        headers: { Authorization: auth }
      })
      if (!res.ok && res.status !== 404) {
        throw new Error(`WebDAV delete failed: ${res.status}`)
      }
      return
    }

    const url = buildS3ObjectUrl({
      endpoint: this.config.endpoint || '',
      bucket: this.config.bucket || '',
      objectKey: this.basePath() + remoteFilename
    })
    const res = await this.signAndFetch('DELETE', url)
    if (!res.ok && res.status !== 404) {
      throw new Error(`S3 delete failed: ${res.status}`)
    }
  }

  async listFiles(): Promise<IncrementalSyncRecord[]> {
    if (this.config.target === 'webdav') {
      return listWebDav(this)
    }
    return listS3(this)
  }
}

export { listS3, uploadS3, downloadS3 } from './mobile-incremental-cloud-s3.ops'
