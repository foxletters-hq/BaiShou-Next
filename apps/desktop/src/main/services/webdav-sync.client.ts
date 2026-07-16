import * as path from 'path'
import * as fs from 'fs'
import { createClient, WebDAVClient } from 'webdav'
import {
  isTransientWebDavHttpStatus,
  normalizeWebDavBaseUrl,
  suggestWebDavHttpFallbackUrl
} from '@baishou/shared'
import { ICloudSyncClient, SyncRecord } from '@baishou/core-desktop'

const MKCOL_OK = new Set([200, 201, 204, 405, 409])
const MKCOL_MAX_ATTEMPTS = 4

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function webDavErrorStatus(error: unknown): number | undefined {
  const e = error as { status?: number; statusCode?: number; response?: { status?: number } }
  return e?.status ?? e?.statusCode ?? e?.response?.status
}

function isLikelyWebDavNetworkError(error: unknown): boolean {
  const status = webDavErrorStatus(error)
  if (typeof status === 'number' && status > 0) return false
  const msg = error instanceof Error ? error.message : String(error)
  return /network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|certificate|SSL|TLS|UNABLE_TO_VERIFY|fetch failed|socket/i.test(
    msg
  )
}

/**
 * WebDAV 云客户端服务（ZIP 全量备份）
 * 支持 Nextcloud、群晖 (Synology) 和自搭 WebDAV 服务器。
 * 与 IncrementalWebDavClient（增量同步）互为独立实现。
 */
export class WebDavSyncClient implements ICloudSyncClient {
  private client: WebDAVClient
  private baseUrl: string
  private readonly username: string
  private readonly password: string
  private basePath: string

  constructor(url: string, username: string, password: string, basePath: string) {
    this.username = username
    this.password = password
    this.baseUrl = normalizeWebDavBaseUrl(url)
    this.client = createClient(this.baseUrl, { username, password })
    this.basePath = basePath.endsWith('/') ? basePath : basePath + '/'
  }

  private recreateClient(url: string): void {
    this.baseUrl = normalizeWebDavBaseUrl(url)
    this.client = createClient(this.baseUrl, {
      username: this.username,
      password: this.password
    })
  }

  /** HTTPS 连不上时尝试群晖常见 HTTP 回退（如 5006→5005） */
  private async withHttpFallback<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op()
    } catch (error) {
      if (!isLikelyWebDavNetworkError(error)) throw error
      const fallback = suggestWebDavHttpFallbackUrl(this.baseUrl)
      if (!fallback || fallback === this.baseUrl) throw error
      this.recreateClient(fallback)
      return await op()
    }
  }

  /**
   * 递归地确保远端目录层级存在（WebDAV MKCOL 一次只能建一级）
   */
  private async ensureDirExists(dirPath: string): Promise<void> {
    const parts = dirPath.split('/').filter(Boolean)
    let currentPath = ''
    for (const part of parts) {
      currentPath += '/' + part
      let lastError: unknown
      for (let attempt = 0; attempt < MKCOL_MAX_ATTEMPTS; attempt++) {
        try {
          await this.client.createDirectory(currentPath)
          lastError = undefined
          break
        } catch (e: unknown) {
          lastError = e
          const status = webDavErrorStatus(e)
          if (typeof status === 'number' && MKCOL_OK.has(status)) {
            lastError = undefined
            break
          }
          if (
            typeof status !== 'number' ||
            !isTransientWebDavHttpStatus(status) ||
            attempt >= MKCOL_MAX_ATTEMPTS - 1
          ) {
            break
          }
          await sleepMs(400 * 2 ** attempt)
        }
      }
      // 与旧行为一致：目录已存在或偶发失败时继续尝试 PUT；最终由上传结果决定成败
      void lastError
    }
  }

  async uploadFile(localFilePath: string): Promise<void> {
    await this.withHttpFallback(async () => {
      const filename = path.basename(localFilePath)
      await this.ensureDirExists(this.basePath)

      const remotePath = this.basePath + filename
      const readStream = fs.createReadStream(localFilePath)
      await this.client.putFileContents(remotePath, readStream as any, { overwrite: true })
    })
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    await this.withHttpFallback(async () => {
      const remotePath = this.basePath + remoteFilename
      const writeStream = fs.createWriteStream(localDestPath)
      const readStream = this.client.createReadStream(remotePath)

      await new Promise<void>((resolve, reject) => {
        readStream.pipe(writeStream)
        writeStream.on('finish', () => resolve())
        readStream.on('error', reject)
        writeStream.on('error', reject)
      })
    })
  }

  async listFiles(): Promise<SyncRecord[]> {
    return this.withHttpFallback(async () => {
      const records: SyncRecord[] = []

      try {
        const items = (await this.client.getDirectoryContents(this.basePath)) as any[]

        for (const item of items) {
          if (item.type === 'directory') continue
          // 仅列出 .zip 文件，不限制命名前缀
          if (!/\.zip$/i.test(item.basename)) continue
          const isManaged = /^BaiShou_.*\.zip$/i.test(item.basename)
          records.push({
            filename: item.basename,
            lastModified: new Date(item.lastmod),
            sizeInBytes: item.size || 0,
            managed: isManaged
          })
        }

        records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
      } catch (e: any) {
        if (e.status === 404 || e.message?.includes('404')) {
          return []
        }
        throw new Error(`WebDAV 列出文件失败: ${e.message || e}`)
      }

      return records
    })
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    await this.withHttpFallback(async () => {
      const remotePath = this.basePath + remoteFilename
      await this.client.deleteFile(remotePath)
    })
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    await this.withHttpFallback(async () => {
      const oldPath = this.basePath + oldFilename
      const newPath = this.basePath + newFilename
      await this.client.moveFile(oldPath, newPath)
    })
  }
}
