import * as path from 'path'
import * as fs from 'fs'
import { createClient, WebDAVClient } from 'webdav'
import type { ICloudSyncClient, SyncRecord } from '@baishou/core'

/**
 * 增量同步 WebDAV 客户端
 * 保留完整目录结构，用于逐文件增量同步。
 * 与 WebDavSyncClient（ZIP 全量备份）互为独立实现。
 */
export class IncrementalWebDavClient implements ICloudSyncClient {
  private client: WebDAVClient
  private basePath: string
  private vaultPath: string | null = null

  constructor(url: string, username: string, password: string, basePath: string) {
    let safeUrl = url && url.trim() !== '' ? url : 'http://localhost'
    if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
      safeUrl = 'http://' + safeUrl
    }
    this.client = createClient(safeUrl, { username, password })
    const p = basePath || ''
    this.basePath = p.endsWith('/') ? p : p + '/'
  }

  setVaultPath(vaultPath: string): void {
    this.vaultPath = vaultPath
  }

  private async ensureDir(dirPath: string): Promise<void> {
    const parts = dirPath.split('/').filter(Boolean)
    let current = ''
    for (const part of parts) {
      current += '/' + part
      try {
        await this.client.createDirectory(current)
      } catch {}
    }
  }

  async uploadFile(localFilePath: string): Promise<void> {
    const relativePath = this.vaultPath
      ? path.relative(this.vaultPath, localFilePath).replace(/\\/g, '/')
      : path.basename(localFilePath)

    const remotePath = this.basePath + relativePath
    const dir = path.dirname(remotePath)
    if (dir !== this.basePath.slice(0, -1)) {
      await this.ensureDir(dir)
    }

    const readStream = fs.createReadStream(localFilePath)
    await this.client.putFileContents(remotePath, readStream as any, { overwrite: true })
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const remotePath = this.basePath + remoteFilename
    const dir = path.dirname(localDestPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const writeStream = fs.createWriteStream(localDestPath)
    const readStream = this.client.createReadStream(remotePath)

    return new Promise((resolve, reject) => {
      readStream.pipe(writeStream)
      writeStream.on('finish', () => resolve())
      readStream.on('error', reject)
      writeStream.on('error', reject)
    })
  }

  async listFiles(): Promise<SyncRecord[]> {
    const records: SyncRecord[] = []

    try {
      const items = (await this.client.getDirectoryContents(this.basePath, { deep: true })) as any[]
      for (const item of items) {
        if (!item || item.type === 'directory') continue

        let relativeName = item.filename || item.basename
        const idx = relativeName.indexOf(this.basePath)
        if (idx !== -1) {
          relativeName = relativeName.substring(idx + this.basePath.length)
        } else {
          const cleanBasePath = this.basePath.replace(/^\/+|\/+$/g, '')
          const cleanIdx = relativeName.indexOf(cleanBasePath)
          if (cleanIdx !== -1) {
            relativeName = relativeName.substring(cleanIdx + cleanBasePath.length)
          } else {
            relativeName = item.basename || relativeName
          }
        }

        if (relativeName.startsWith('/')) {
          relativeName = relativeName.substring(1)
        }

        records.push({
          filename: relativeName,
          lastModified: item.lastmod ? new Date(item.lastmod) : new Date(),
          sizeInBytes: item.size || 0,
          managed: /^BaiShou_.*\.zip$/i.test(relativeName)
        })
      }
    } catch (e: any) {
      if (e.status === 404 || e.message?.includes('404')) return []
      throw new Error(`WebDAV list failed: ${e.message || e}`)
    }

    return records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
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
