import * as path from 'path'
import * as Minio from 'minio'
import { ICloudSyncClient, SyncRecord } from '@baishou/core-desktop'

/**
 * S3 兼容对象存储客户端
 * 支持 AWS S3, 腾讯云 COS, 阿里云 OSS, Cloudflare R2, MinIO 等
 * 1:1 还原老白守 s3_client_service.dart 的全部能力
 */
export class S3SyncClient implements ICloudSyncClient {
  private client: Minio.Client
  private bucket: string
  private basePath: string

  constructor(
    endpoint: string,
    region: string,
    bucket: string,
    accessKey: string,
    secretKey: string,
    basePath: string
  ) {
    const uri = new URL(endpoint)
    this.client = new Minio.Client({
      endPoint: uri.hostname,
      port: uri.port ? parseInt(uri.port) : uri.protocol === 'https:' ? 443 : 80,
      useSSL: uri.protocol === 'https:',
      accessKey,
      secretKey,
      region: region || 'us-east-1',
      pathStyle: false // 兼容腾讯云 COS 的 Virtual-hosted style 寻址
    })
    this.bucket = bucket

    // 标准化路径：确保 basePath 不以 / 开头但以 / 结尾
    let p = basePath
    if (p.startsWith('/')) p = p.substring(1)
    if (!p.endsWith('/') && p.length > 0) p += '/'
    this.basePath = p
  }

  async uploadFile(localFilePath: string): Promise<void> {
    const filename = path.basename(localFilePath)
    const objectName = this.basePath + filename

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
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1)

    // 并发限制执行池
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
      await limitExecute(partNumbers, 5, async (partNumber) => {
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

        // 兼容处理可能带有双引号的 ETag，清洗掉外层的引号以兼容更多 S3 存储提供商
        let etag = res.etag || ''
        if (etag.startsWith('"') && etag.endsWith('"')) {
          etag = etag.slice(1, -1)
        }

        parts.push({
          part: partNumber,
          etag
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
    const objectName = this.basePath + remoteFilename
    await this.client.fGetObject(this.bucket, objectName, localDestPath)
  }

  async listFiles(): Promise<SyncRecord[]> {
    const records: SyncRecord[] = []

    return new Promise((resolve, reject) => {
      const stream = this.client.listObjectsV2(this.bucket, this.basePath, true)

      stream.on('data', (obj) => {
        if (!obj.name || obj.name.endsWith('/')) return // skip directory markers
        const filename = path.basename(obj.name)
        // 仅列出 .zip 文件，不限制命名前缀
        if (!/\.zip$/i.test(filename)) return
        const isManaged = /^BaiShou_.*\.zip$/i.test(filename)
        records.push({
          filename,
          lastModified: obj.lastModified || new Date(),
          sizeInBytes: obj.size || 0,
          managed: isManaged
        })
      })

      stream.on('error', (err) => {
        reject(new Error(`S3 列出文件失败: ${err.message}`))
      })

      stream.on('end', () => {
        records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
        resolve(records)
      })
    })
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    const objectName = this.basePath + remoteFilename
    await this.client.removeObject(this.bucket, objectName)
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    const oldObjectName = this.basePath + oldFilename
    const newObjectName = this.basePath + newFilename

    // S3 不支持原子 rename，只能 copy + delete
    const conditions = new Minio.CopyConditions()
    await this.client.copyObject(
      this.bucket,
      newObjectName,
      `/${this.bucket}/${oldObjectName}`,
      conditions
    )
    await this.client.removeObject(this.bucket, oldObjectName)
  }
}
