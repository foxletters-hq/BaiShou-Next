import * as path from 'path'
import * as Minio from 'minio'
import type { ICloudSyncClient, SyncRecord } from '@baishou/core-desktop'

/**
 * 增量同步 S3 客户端
 * 与 S3SyncClient 不同，此客户端保留完整的目录结构路径
 * 适用于多文件增量同步场景
 */
export class IncrementalS3Client implements ICloudSyncClient {
  private client: Minio.Client
  private bucket: string
  private basePath: string
  private vaultPath: string | null = null
  private chunkConcurrency: number

  constructor(
    endpoint: string,
    region: string,
    bucket: string,
    accessKey: string,
    secretKey: string,
    basePath: string,
    chunkConcurrency?: number
  ) {
    let safeEndpoint = endpoint && endpoint.trim() !== '' ? endpoint : 'http://localhost'
    if (!safeEndpoint.startsWith('http://') && !safeEndpoint.startsWith('https://')) {
      safeEndpoint = 'http://' + safeEndpoint
    }
    const uri = new URL(safeEndpoint)
    this.client = new Minio.Client({
      endPoint: uri.hostname || 'localhost',
      port: uri.port ? parseInt(uri.port) : uri.protocol === 'https:' ? 443 : 80,
      useSSL: uri.protocol === 'https:',
      accessKey,
      secretKey,
      region: region || 'us-east-1',
      pathStyle: false
    })
    this.bucket = bucket
    this.chunkConcurrency = chunkConcurrency || 5

    let p = basePath || ''
    if (p.startsWith('/')) p = p.substring(1)
    if (!p.endsWith('/') && p.length > 0) p += '/'
    this.basePath = p
  }

  setVaultPath(vaultPath: string): void {
    this.vaultPath = vaultPath
  }

  async uploadFile(localFilePath: string): Promise<void> {
    // 从本地绝对路径计算出相对于 vault 根目录的路径，保留完整目录结构
    const relativePath = this.vaultPath
      ? path.relative(this.vaultPath, localFilePath).replace(/\\/g, '/')
      : path.basename(localFilePath)
    const objectName = this.basePath + relativePath

    const fs = require('fs')
    const stat = await fs.promises.stat(localFilePath)
    const fileSize = stat.size
    const partSize = 5 * 1024 * 1024 // 5MB

    if (fileSize <= partSize) {
      await this.client.fPutObject(this.bucket, objectName, localFilePath)
      return
    }

    // 初始化 Multipart Upload
    const mime = require('mime-types')
    const contentType = mime.lookup(localFilePath) || 'application/octet-stream'
    const uploadId = await (this.client as any).initiateNewMultipartUpload(
      this.bucket,
      objectName,
      {
        'Content-Type': contentType
      }
    )

    const totalParts = Math.ceil(fileSize / partSize)
    const parts: { part: number; etag: string }[] = []

    // 实现一个带并发限制的上传池
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1)

    const limitExecute = async <T, R>(
      items: T[],
      concurrencyLimit: number,
      fn: (item: T) => Promise<R>
    ): Promise<R[]> => {
      const results: R[] = []
      const executing: Promise<void>[] = []
      let index = 0

      const enqueue = async (): Promise<void> => {
        if (index === items.length) {
          return Promise.resolve()
        }
        const currentIndex = index++
        const item = items[currentIndex]!
        const p = fn(item).then((result) => {
          results[currentIndex] = result
        })
        executing.push(p)
        const clean = () => executing.splice(executing.indexOf(p), 1)
        p.then(clean, clean)

        if (executing.length >= concurrencyLimit) {
          await Promise.race(executing)
        }
        return enqueue()
      }

      await enqueue()
      await Promise.all(executing)
      return results
    }

    const fileHandle = await fs.promises.open(localFilePath, 'r')
    try {
      await limitExecute(partNumbers, this.chunkConcurrency, async (partNumber) => {
        const start = (partNumber - 1) * partSize
        const end = Math.min(fileSize - 1, partNumber * partSize - 1)
        const chunkSize = end - start + 1
        const buffer = Buffer.alloc(chunkSize)
        await fileHandle.read(buffer, 0, chunkSize, start)

        const md5 = require('crypto').createHash('md5').update(buffer).digest('base64')
        const headers = {
          'Content-Length': chunkSize.toString(),
          'Content-MD5': md5
        }

        const res = await (this.client as any).uploadPart(
          {
            bucketName: this.bucket,
            objectName,
            uploadID: uploadId,
            partNumber,
            headers
          },
          buffer
        )

        parts.push({
          part: partNumber,
          etag: res.etag
        })
      })

      // 排序 parts 数组
      parts.sort((a, b) => a.part - b.part)

      // 完成 Multipart Upload
      await (this.client as any).completeMultipartUpload(this.bucket, objectName, uploadId, parts)
    } catch (err) {
      // 发生错误时中止 Multipart Upload，防止产生脏数据
      try {
        await (this.client as any).abortMultipartUpload(this.bucket, objectName, uploadId)
      } catch {}
      throw err
    } finally {
      await fileHandle.close()
    }
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    // remoteFilename 是相对于 basePath 的远端路径（不含 basePath 前缀）
    const objectName = this.basePath + remoteFilename
    // 确保目标目录存在
    const { mkdirSync, existsSync } = require('fs')
    const dir = path.dirname(localDestPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    await this.client.fGetObject(this.bucket, objectName, localDestPath)
  }

  async listFiles(): Promise<SyncRecord[]> {
    const records: SyncRecord[] = []

    return new Promise((resolve, reject) => {
      const stream = this.client.listObjectsV2(this.bucket, this.basePath, true)

      stream.on('data', (obj) => {
        if (!obj.name || obj.name.endsWith('/')) return

        const relativeName = obj.name.substring(this.basePath.length)

        records.push({
          filename: relativeName,
          lastModified: obj.lastModified || new Date(),
          sizeInBytes: obj.size || 0,
          managed: /^BaiShou_.*\.zip$/i.test(relativeName)
        })
      })

      stream.on('end', () =>
        resolve(records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()))
      )
      stream.on('error', reject)
    })
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    const objectName = this.basePath + remoteFilename
    await this.client.removeObject(this.bucket, objectName)
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    const oldObjectName = this.basePath + oldFilename
    const newObjectName = this.basePath + newFilename
    // S3 rename = copy + delete
    await this.client.copyObject(
      this.bucket,
      newObjectName,
      `/${this.bucket}/${oldObjectName}`,
      undefined
    )
    await this.client.removeObject(this.bucket, oldObjectName)
  }
}
