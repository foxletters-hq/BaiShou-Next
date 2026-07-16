import * as path from 'path'
import * as fs from 'fs'
import { createClient, WebDAVClient } from 'webdav'
import {
  INCREMENTAL_SYNC_CHUNK_SIZE,
  WEBDAV_SHALLOW_LIST_CONCURRENCY,
  limitExecute
} from '@baishou/shared'
import type { ICloudSyncClient, SyncRecord } from '@baishou/core-desktop'

/**
 * 增量同步 WebDAV 客户端
 * 保留完整目录结构，用于逐文件增量同步。
 * 与 WebDavSyncClient（ZIP 全量备份）互为独立实现。
 */
export class IncrementalWebDavClient implements ICloudSyncClient {
  private client: WebDAVClient
  private basePath: string
  private vaultPath: string | null = null
  private chunkConcurrency: number

  constructor(
    url: string,
    username: string,
    password: string,
    basePath: string,
    chunkConcurrency?: number
  ) {
    let safeUrl = url && url.trim() !== '' ? url : 'http://localhost'
    if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
      safeUrl = 'http://' + safeUrl
    }
    this.client = createClient(safeUrl, { username, password })
    const p = basePath || ''
    this.basePath = p.endsWith('/') ? p : p + '/'
    this.chunkConcurrency = chunkConcurrency || 5
  }

  setVaultPath(vaultPath: string): void {
    this.vaultPath = vaultPath
  }

  private async ensureDir(dirPath: string): Promise<void> {
    const parts = dirPath
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean)
    if (parts.length === 0) return

    let current = ''
    for (const part of parts) {
      current = current ? `${current}/${part}` : part
      try {
        await this.client.createDirectory(current)
      } catch {
        // 目录已存在（部分服务器返回 405/409）
      }
    }
  }

  private async ensureBasePath(): Promise<void> {
    const baseDir = this.basePath.replace(/\/$/, '')
    if (baseDir) {
      await this.ensureDir(baseDir)
    }
  }

  private relativePath(localFilePath: string): string {
    return this.vaultPath
      ? path.relative(this.vaultPath, localFilePath).replace(/\\/g, '/')
      : path.basename(localFilePath)
  }

  private remotePath(relativePath: string): string {
    return this.basePath + relativePath
  }

  private async getRemoteSize(remotePath: string): Promise<number> {
    try {
      const stat = await this.client.stat(remotePath)
      const size =
        stat && typeof stat === 'object' && 'data' in stat
          ? (stat as { data?: { size?: number } }).data?.size
          : (stat as { size?: number } | undefined)?.size
      if (typeof size === 'number') {
        return size
      }
    } catch {}
    return 0
  }

  private async verifyUploadSize(remotePath: string, expectedSize: number): Promise<void> {
    const remoteSize = await this.getRemoteSize(remotePath)
    if (remoteSize !== expectedSize) {
      throw new Error(`WebDAV upload size mismatch: expected ${expectedSize}, got ${remoteSize}`)
    }
  }

  async uploadFile(localFilePath: string, remoteRelPath?: string): Promise<void> {
    await this.ensureBasePath()
    const relativePath = remoteRelPath?.replace(/\\/g, '/') ?? this.relativePath(localFilePath)
    const remotePath = this.remotePath(relativePath)
    const dir = path.dirname(remotePath).replace(/\\/g, '/')
    if (dir && dir !== '.') {
      await this.ensureDir(dir)
    }

    const stat = await fs.promises.stat(localFilePath)
    const fileSize = stat.size

    if (fileSize <= INCREMENTAL_SYNC_CHUNK_SIZE) {
      const readStream = fs.createReadStream(localFilePath)
      await this.client.putFileContents(remotePath, readStream as any, { overwrite: true })
      await this.verifyUploadSize(remotePath, fileSize)
      return
    }

    try {
      await this.uploadFileChunked(localFilePath, remotePath, fileSize)
      await this.verifyUploadSize(remotePath, fileSize)
    } catch {
      const readStream = fs.createReadStream(localFilePath)
      await this.client.putFileContents(remotePath, readStream as any, { overwrite: true })
      await this.verifyUploadSize(remotePath, fileSize)
    }
  }

  private async uploadFileChunked(
    localFilePath: string,
    remotePath: string,
    fileSize: number
  ): Promise<void> {
    const totalParts = Math.ceil(fileSize / INCREMENTAL_SYNC_CHUNK_SIZE)
    const fileHandle = await fs.promises.open(localFilePath, 'r')

    try {
      const firstEnd = Math.min(INCREMENTAL_SYNC_CHUNK_SIZE, fileSize) - 1
      const firstBuf = Buffer.alloc(firstEnd + 1)
      await fileHandle.read(firstBuf, 0, firstBuf.length, 0)
      await this.client.putFileContents(remotePath, firstBuf, { overwrite: true })

      if (totalParts <= 1) return

      const restParts = Array.from({ length: totalParts - 1 }, (_, i) => i + 2)
      await limitExecute(restParts, this.chunkConcurrency, async (partNumber) => {
        const start = (partNumber - 1) * INCREMENTAL_SYNC_CHUNK_SIZE
        const end = Math.min(start + INCREMENTAL_SYNC_CHUNK_SIZE, fileSize) - 1
        const length = end - start + 1
        const buf = Buffer.alloc(length)
        await fileHandle.read(buf, 0, length, start)
        await (this.client as any).partialUpdateFileContents(remotePath, start, end, buf)
      })
    } finally {
      await fileHandle.close()
    }
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const remotePath = this.basePath + remoteFilename
    const dir = path.dirname(localDestPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const fileSize = await this.getRemoteSize(remotePath)
    if (fileSize <= INCREMENTAL_SYNC_CHUNK_SIZE) {
      const writeStream = fs.createWriteStream(localDestPath)
      const readStream = this.client.createReadStream(remotePath)
      return new Promise((resolve, reject) => {
        readStream.pipe(writeStream)
        writeStream.on('finish', () => resolve())
        readStream.on('error', reject)
        writeStream.on('error', reject)
      })
    }

    try {
      await this.downloadFileChunked(remotePath, localDestPath, fileSize)
    } catch {
      const writeStream = fs.createWriteStream(localDestPath)
      const readStream = this.client.createReadStream(remotePath)
      return new Promise((resolve, reject) => {
        readStream.pipe(writeStream)
        writeStream.on('finish', () => resolve())
        readStream.on('error', reject)
        writeStream.on('error', reject)
      })
    }
  }

  private async downloadFileChunked(
    remotePath: string,
    localDestPath: string,
    fileSize: number
  ): Promise<void> {
    const totalParts = Math.ceil(fileSize / INCREMENTAL_SYNC_CHUNK_SIZE)
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1)
    const fileHandle = await fs.promises.open(localDestPath, 'w')

    try {
      await limitExecute(partNumbers, this.chunkConcurrency, async (partNumber) => {
        const start = (partNumber - 1) * INCREMENTAL_SYNC_CHUNK_SIZE
        const end = Math.min(start + INCREMENTAL_SYNC_CHUNK_SIZE, fileSize) - 1
        const stream = this.client.createReadStream(remotePath, {
          range: { start, end }
        })
        const chunks: Buffer[] = []
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (chunk: Buffer) => chunks.push(chunk))
          stream.on('end', () => resolve())
          stream.on('error', reject)
        })
        const buf = Buffer.concat(chunks)
        await fileHandle.write(buf, 0, buf.length, start)
      })
    } finally {
      await fileHandle.close()
    }
  }

  async listFiles(): Promise<SyncRecord[]> {
    const records: SyncRecord[] = []

    // 列举只读：不在此处 createDirectory，避免测试连接对只读账号产生写副作用
    try {
      await this.collectFilesShallow(this.basePath.replace(/\/$/, '') || '/', records, {
        missingOk: false,
        visited: new Set<string>()
      })
    } catch (e: any) {
      if (e.status === 404 || e.message?.includes('404')) {
        throw new Error(
          `WebDAV list failed: 路径前缀不存在（HTTP 404）。请确认 URL/目录配置后再同步。`
        )
      }
      throw new Error(`WebDAV list failed: ${e.message || e}`)
    }

    return records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  }

  /**
   * 逐目录 Depth:1 PROPFIND，避免单次 deep PROPFIND 触发 fast-xml-parser 实体展开上限。
   * visited + 严格子路径：防止父目录/尾斜杠变体回环造成列举风暴。
   */
  private async collectFilesShallow(
    remoteDir: string,
    records: SyncRecord[],
    options: {
      missingOk?: boolean
      visited?: Set<string>
    } = { missingOk: true }
  ): Promise<void> {
    const visited = options.visited ?? new Set<string>()
    const parentRel = this.toRelativeRemotePath(remoteDir) ?? ''
    if (visited.has(parentRel)) return
    visited.add(parentRel)

    let items: any[]
    try {
      items = (await this.client.getDirectoryContents(remoteDir, { deep: false })) as any[]
    } catch (e: any) {
      if (e.status === 404 || e.message?.includes('404')) {
        if (options.missingOk !== false) return
        throw e
      }
      throw e
    }

    const subdirs: string[] = []

    for (const item of items) {
      if (!item?.filename) continue
      if (item.type === 'directory') {
        const childRel = this.toRelativeRemotePath(String(item.filename))
        if (
          childRel &&
          this.isStrictRelativeChild(parentRel, childRel) &&
          !visited.has(childRel)
        ) {
          subdirs.push(childRel)
        }
        continue
      }

      const relativeName = this.toRelativeFilename(item)
      records.push({
        filename: relativeName,
        lastModified: item.lastmod ? new Date(item.lastmod) : new Date(0),
        sizeInBytes: item.size || 0,
        managed: /^BaiShou_.*\.zip$/i.test(relativeName)
      })
    }

    await limitExecute(subdirs, WEBDAV_SHALLOW_LIST_CONCURRENCY, async (childRel) => {
      await this.collectFilesShallow(this.relativeDirToRequestPath(childRel), records, {
        missingOk: true,
        visited
      })
    })
  }

  private safeDecodePath(value: string): string {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  private toRelativeRemotePath(rawPath: string): string | null {
    const decoded = this.safeDecodePath(rawPath).replace(/\\/g, '/')
    let relativeName = decoded
    const cleanBasePath = this.basePath.replace(/^\/+|\/+$/g, '')

    const baseWithSlash = this.basePath
    const idx = relativeName.indexOf(baseWithSlash)
    if (idx !== -1) {
      relativeName = relativeName.substring(idx + baseWithSlash.length)
    } else {
      const cleanIdx = relativeName.indexOf(cleanBasePath)
      if (cleanIdx !== -1) {
        relativeName = relativeName.substring(cleanIdx + cleanBasePath.length)
      } else if (relativeName.startsWith('http://') || relativeName.startsWith('https://')) {
        try {
          const pathname = new URL(relativeName).pathname.replace(/^\/+/, '')
          const baseIdx = pathname.indexOf(cleanBasePath)
          if (baseIdx === -1) return null
          relativeName = pathname.substring(baseIdx + cleanBasePath.length)
        } catch {
          return null
        }
      } else if (relativeName.startsWith('/')) {
        const pathname = relativeName.replace(/^\/+/, '')
        const baseIdx = pathname.indexOf(cleanBasePath)
        if (baseIdx === -1) return null
        relativeName = pathname.substring(baseIdx + cleanBasePath.length)
      }
    }

    relativeName = relativeName.replace(/^\/+/, '').replace(/\/+$/, '')
    if (relativeName.includes('..')) return null
    return relativeName
  }

  private isStrictRelativeChild(parentRel: string, childRel: string): boolean {
    const parent = parentRel.replace(/^\/+|\/+$/g, '')
    const child = childRel.replace(/^\/+|\/+$/g, '')
    if (!child || child === parent) return false
    if (!parent) return true
    return child.startsWith(`${parent}/`)
  }

  private relativeDirToRequestPath(relativeDir: string): string {
    const baseDir = this.basePath.replace(/\/$/, '')
    if (!relativeDir) return baseDir || '/'
    return `${baseDir}/${relativeDir}`
  }

  private toRelativeFilename(item: { filename?: string; basename?: string }): string {
    const raw = item.filename || item.basename || ''
    return this.toRelativeRemotePath(raw) ?? (item.basename || raw).replace(/^\/+/, '')
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    const remotePath = this.basePath + remoteFilename
    await this.client.deleteFile(remotePath)
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    const oldPath = this.basePath + oldFilename
    const newPath = this.basePath + newFilename
    await this.client.moveFile(oldPath, newPath)
  }
}
