import type { IFileSystem } from '@baishou/core-mobile'
import {
  buildS3ListUrl,
  buildS3ObjectUrl,
  buildS3ObjectUrlWithQuery,
  fetchAllS3ListPages,
  INCREMENTAL_SYNC_CHUNK_SIZE,
  limitExecute,
  normalizeS3BasePath,
  s3FetchHeaders,
  signS3Request,
  type S3SyncConfig
} from '@baishou/shared'
import * as ExpoFS from 'expo-file-system/legacy'
import { isExternalStoragePath, toFileUri } from './android-external-fs'
import { getAppCacheDirectory } from './mobile-app-paths'
import { FileSystemUploadType, downloadAsync, uploadAsync } from './mobile-http-transfer'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const step = 8192
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

export type IncrementalSyncRecord = {
  filename: string
  lastModified: Date
  sizeInBytes: number
  managed: boolean
}

/** 增量同步用云客户端（S3 / WebDAV），保留 vault 相对路径 */
export class MobileIncrementalCloudClient {
  private vaultPath: string | null = null

  constructor(
    private config: S3SyncConfig,
    private readonly fileSystem: IFileSystem
  ) {}

  setVaultPath(vaultPath: string) {
    this.vaultPath = vaultPath
  }

  private basePath(): string {
    return normalizeS3BasePath(this.config.path)
  }

  private async signAndFetch(
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
    return fetch(url, { method, headers: s3FetchHeaders(signed) })
  }

  private relFromLocal(localFilePath: string): string {
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

  /** expo downloadAsync / uploadAsync 无法直接读写 BaiShou_Root 等外部路径，经沙盒缓存中转 */
  private needsHttpStaging(localPath: string): boolean {
    return isExternalStoragePath(localPath)
  }

  private httpStagingPath(localPath: string, prefix: 'dl' | 'ul'): string {
    const name = localPath.replace(/\\/g, '/').split('/').pop() || 'file'
    return `${getAppCacheDirectory()}sync_${prefix}_${Date.now()}_${name}`
  }

  private async withHttpUploadPath<T>(
    localFilePath: string,
    fn: (httpPath: string) => Promise<T>
  ): Promise<T> {
    if (!this.needsHttpStaging(localFilePath)) {
      return fn(localFilePath)
    }
    const staged = this.httpStagingPath(localFilePath, 'ul')
    await this.fileSystem.copyFile(localFilePath, staged)
    try {
      return await fn(staged)
    } finally {
      await this.fileSystem.unlink(staged).catch(() => {})
    }
  }

  async listFiles(): Promise<IncrementalSyncRecord[]> {
    if (this.config.target === 'webdav') {
      return this.listWebDav()
    }
    return this.listS3()
  }

  async uploadFile(localFilePath: string): Promise<void> {
    const rel = this.relFromLocal(localFilePath)
    await this.withHttpUploadPath(localFilePath, async (httpPath) => {
      if (this.config.target === 'webdav') {
        await this.uploadWebDav(rel, httpPath)
      } else {
        await this.uploadS3(rel, httpPath)
      }
    })
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const parent = localDestPath.replace(/\/[^/]+$/, '')
    if (!(await this.fileSystem.exists(parent))) {
      await this.fileSystem.mkdir(parent, { recursive: true })
    }

    const staged = this.needsHttpStaging(localDestPath)
      ? this.httpStagingPath(localDestPath, 'dl')
      : localDestPath

    if (this.config.target === 'webdav') {
      await this.downloadWebDav(remoteFilename, staged)
    } else {
      await this.downloadS3(remoteFilename, staged)
    }

    if (staged !== localDestPath) {
      await this.fileSystem.copyFile(staged, localDestPath)
      await this.fileSystem.unlink(staged).catch(() => {})
    }
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    if (this.config.target === 'webdav') {
      const baseUrl = (this.config.webdavUrl || '').replace(/\/$/, '')
      const remotePath = this.basePath() + remoteFilename
      const auth = `Basic ${btoa(`${this.config.accessKey}:${this.config.secretKey}`)}`
      const res = await fetch(`${baseUrl}/${remotePath.replace(/^\//, '')}`, {
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

  private async listS3(): Promise<IncrementalSyncRecord[]> {
    const prefix = this.basePath()
    const objects = await fetchAllS3ListPages(async (continuationToken) => {
      const listUrl = buildS3ListUrl({
        endpoint: this.config.endpoint || '',
        bucket: this.config.bucket || '',
        prefix,
        continuationToken
      })
      const response = await this.signAndFetch('GET', listUrl)
      if (!response.ok) throw new Error(`S3 list failed: ${response.status}`)
      return response.text()
    })

    const records: IncrementalSyncRecord[] = []
    for (const obj of objects) {
      if (obj.key.endsWith('/')) continue
      let rel = obj.key
      if (rel.startsWith(prefix)) rel = rel.slice(prefix.length)
      records.push({
        filename: rel,
        lastModified: new Date(obj.lastModified || Date.now()),
        sizeInBytes: obj.size || 0,
        managed: /^BaiShou_.*\.zip$/i.test(rel)
      })
    }
    return records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  }

  private async listWebDav(): Promise<IncrementalSyncRecord[]> {
    const baseUrl = (this.config.webdavUrl || '').replace(/\/$/, '')
    const basePath = this.config.path?.startsWith('/')
      ? this.config.path
      : `/${this.config.path || ''}`
    const auth = `Basic ${btoa(`${this.config.accessKey}:${this.config.secretKey}`)}`
    const response = await fetch(`${baseUrl}${basePath}`, {
      method: 'PROPFIND',
      headers: {
        Authorization: auth,
        Depth: 'infinity',
        'Content-Type': 'application/xml'
      }
    })
    if (!response.ok && response.status !== 404) {
      throw new Error(`WebDAV PROPFIND failed: ${response.status}`)
    }
    if (response.status === 404) return []
    const xml = await response.text()
    const records: IncrementalSyncRecord[] = []
    const hrefRegex = /<[^:]*:?href>([^<]+)<\/[^:]*:?href>/gi
    let m: RegExpExecArray | null
    const prefix = basePath.replace(/\/$/, '')
    while ((m = hrefRegex.exec(xml))) {
      const href = decodeURIComponent(m[1]!)
      if (href.endsWith('/')) continue
      let rel = href
      const idx = rel.indexOf(prefix)
      if (idx >= 0) rel = rel.slice(idx + prefix.length).replace(/^\//, '')
      else rel = rel.split('/').pop() || rel
      if (!rel || rel.includes('..')) continue
      records.push({
        filename: rel,
        lastModified: new Date(),
        sizeInBytes: 0,
        managed: /^BaiShou_.*\.zip$/i.test(rel)
      })
    }
    return records
  }

  private async uploadS3(rel: string, localFilePath: string) {
    const stat = await this.fileSystem.stat(localFilePath)
    const fileSize = stat.size ?? 0
    if (fileSize <= INCREMENTAL_SYNC_CHUNK_SIZE) {
      await this.uploadS3Single(rel, localFilePath)
      return
    }
    await this.uploadS3Multipart(rel, localFilePath, fileSize)
  }

  private s3ObjectKey(rel: string): string {
    return this.basePath() + rel
  }

  private s3UrlOptions(rel: string) {
    return {
      endpoint: this.config.endpoint || '',
      bucket: this.config.bucket || '',
      objectKey: this.s3ObjectKey(rel)
    }
  }

  private async uploadS3Single(rel: string, localFilePath: string) {
    const url = buildS3ObjectUrl(this.s3UrlOptions(rel))
    const contentType = 'application/octet-stream'
    const signed = await signS3Request(
      'PUT',
      url,
      this.config.region || 'us-east-1',
      this.config.accessKey || '',
      this.config.secretKey || '',
      null,
      { 'Content-Type': contentType }
    )
    const response = await uploadAsync(url, localFilePath, {
      httpMethod: 'PUT',
      headers: { ...s3FetchHeaders(signed), 'Content-Type': contentType },
      uploadType: FileSystemUploadType.BINARY_CONTENT
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`S3 upload failed: ${response.status}`)
    }
  }

  private async readFileChunk(
    localFilePath: string,
    position: number,
    length: number
  ): Promise<ArrayBuffer> {
    const b64 = await ExpoFS.readAsStringAsync(toFileUri(localFilePath), {
      encoding: ExpoFS.EncodingType.Base64,
      position,
      length
    })
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  private parseS3UploadId(xml: string): string {
    const match = xml.match(/<UploadId>([^<]+)<\/UploadId>/)
    if (!match?.[1]) {
      throw new Error('S3 multipart initiate: missing UploadId')
    }
    return match[1]
  }

  private buildCompleteMultipartXml(parts: { part: number; etag: string }[]): string {
    const body = parts
      .sort((a, b) => a.part - b.part)
      .map(
        (p) =>
          `<Part><PartNumber>${p.part}</PartNumber><ETag>${p.etag}</ETag></Part>`
      )
      .join('')
    return `<CompleteMultipartUpload>${body}</CompleteMultipartUpload>`
  }

  private normalizeEtag(etag: string | null): string {
    if (!etag) throw new Error('S3 uploadPart: missing ETag')
    return etag.startsWith('"') ? etag : `"${etag}"`
  }

  private async uploadS3Multipart(rel: string, localFilePath: string, fileSize: number) {
    const region = this.config.region || 'us-east-1'
    const accessKey = this.config.accessKey || ''
    const secretKey = this.config.secretKey || ''
    const urlOpts = this.s3UrlOptions(rel)
    const contentType = 'application/octet-stream'
    const chunkConcurrency = this.config.chunkConcurrency ?? 5

    const initiateUrl = buildS3ObjectUrlWithQuery({
      ...urlOpts,
      query: { uploads: '' }
    })
    const initiateSigned = await signS3Request(
      'POST',
      initiateUrl,
      region,
      accessKey,
      secretKey,
      null,
      { 'Content-Type': contentType }
    )
    const initiateRes = await fetch(initiateUrl, {
      method: 'POST',
      headers: { ...s3FetchHeaders(initiateSigned), 'Content-Type': contentType }
    })
    if (!initiateRes.ok) {
      throw new Error(`S3 multipart initiate failed: ${initiateRes.status}`)
    }
    const uploadId = this.parseS3UploadId(await initiateRes.text())

    const totalParts = Math.ceil(fileSize / INCREMENTAL_SYNC_CHUNK_SIZE)
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1)

    try {
      const parts = await limitExecute(partNumbers, chunkConcurrency, async (partNumber) => {
        const start = (partNumber - 1) * INCREMENTAL_SYNC_CHUNK_SIZE
        const chunkSize = Math.min(INCREMENTAL_SYNC_CHUNK_SIZE, fileSize - start)
        const body = await this.readFileChunk(localFilePath, start, chunkSize)

        const partUrl = buildS3ObjectUrlWithQuery({
          ...urlOpts,
          query: { partNumber: String(partNumber), uploadId }
        })
        const signed = await signS3Request('PUT', partUrl, region, accessKey, secretKey, body)
        const res = await fetch(partUrl, {
          method: 'PUT',
          headers: s3FetchHeaders(signed),
          body
        })
        if (!res.ok) {
          throw new Error(`S3 uploadPart ${partNumber} failed: ${res.status}`)
        }
        return { part: partNumber, etag: this.normalizeEtag(res.headers.get('ETag')) }
      })

      const completeXml = this.buildCompleteMultipartXml(parts)
      const completeBody = new TextEncoder().encode(completeXml)
      const completeUrl = buildS3ObjectUrlWithQuery({
        ...urlOpts,
        query: { uploadId }
      })
      const completeSigned = await signS3Request(
        'POST',
        completeUrl,
        region,
        accessKey,
        secretKey,
        completeBody,
        { 'Content-Type': 'application/xml' }
      )
      const completeRes = await fetch(completeUrl, {
        method: 'POST',
        headers: {
          ...s3FetchHeaders(completeSigned),
          'Content-Type': 'application/xml'
        },
        body: completeXml
      })
      if (!completeRes.ok) {
        throw new Error(`S3 multipart complete failed: ${completeRes.status}`)
      }
    } catch (err) {
      const abortUrl = buildS3ObjectUrlWithQuery({ ...urlOpts, query: { uploadId } })
      try {
        const abortSigned = await signS3Request('DELETE', abortUrl, region, accessKey, secretKey, null)
        await fetch(abortUrl, { method: 'DELETE', headers: s3FetchHeaders(abortSigned) })
      } catch {}
      throw err
    }
  }

  private async downloadS3(rel: string, localDestPath: string) {
    const fileSize = await this.getS3RemoteSize(rel)
    if (fileSize <= INCREMENTAL_SYNC_CHUNK_SIZE) {
      await this.downloadS3Single(rel, localDestPath)
      return
    }
    try {
      await this.downloadS3Chunked(rel, localDestPath, fileSize)
    } catch {
      await this.downloadS3Single(rel, localDestPath)
    }
  }

  private async getS3RemoteSize(rel: string): Promise<number> {
    const url = buildS3ObjectUrl(this.s3UrlOptions(rel))
    const signed = await signS3Request(
      'HEAD',
      url,
      this.config.region || 'us-east-1',
      this.config.accessKey || '',
      this.config.secretKey || '',
      null
    )
    const res = await fetch(url, { method: 'HEAD', headers: s3FetchHeaders(signed) })
    if (!res.ok) return 0
    const cl = res.headers.get('Content-Length')
    return cl ? parseInt(cl, 10) : 0
  }

  private async downloadS3Single(rel: string, localDestPath: string) {
    const url = buildS3ObjectUrl({
      endpoint: this.config.endpoint || '',
      bucket: this.config.bucket || '',
      objectKey: this.basePath() + rel
    })
    const signed = await signS3Request(
      'GET',
      url,
      this.config.region || 'us-east-1',
      this.config.accessKey || '',
      this.config.secretKey || '',
      null
    )
    const res = await downloadAsync(url, localDestPath, { headers: s3FetchHeaders(signed) })
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`S3 download failed: ${res.status}`)
    }
  }

  private async downloadS3Chunked(rel: string, localDestPath: string, fileSize: number) {
    const urlOpts = this.s3UrlOptions(rel)
    const url = buildS3ObjectUrl(urlOpts)
    const region = this.config.region || 'us-east-1'
    const accessKey = this.config.accessKey || ''
    const secretKey = this.config.secretKey || ''
    const chunkConcurrency = this.config.chunkConcurrency ?? 5
    const totalParts = Math.ceil(fileSize / INCREMENTAL_SYNC_CHUNK_SIZE)
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1)
    const cachePrefix = `${getAppCacheDirectory()}s3_${Date.now()}_`

    const chunkPaths = await limitExecute(partNumbers, chunkConcurrency, async (partNumber) => {
      const start = (partNumber - 1) * INCREMENTAL_SYNC_CHUNK_SIZE
      const end = Math.min(start + INCREMENTAL_SYNC_CHUNK_SIZE, fileSize) - 1
      const chunkPath = `${cachePrefix}part_${partNumber}`
      const rangeHeader = { Range: `bytes=${start}-${end}` }
      const signed = await signS3Request('GET', url, region, accessKey, secretKey, null, rangeHeader)
      const res = await fetch(url, { headers: { ...s3FetchHeaders(signed), ...rangeHeader } })
      if (res.status !== 206) {
        throw new Error(`S3 range download requires 206, got ${res.status}`)
      }
      const b64 = arrayBufferToBase64(await res.arrayBuffer())
      await ExpoFS.writeAsStringAsync(toFileUri(chunkPath), b64, {
        encoding: ExpoFS.EncodingType.Base64
      })
      return chunkPath
    })

    try {
      await this.assembleChunkFilesInSandbox(chunkPaths, localDestPath)
    } finally {
      for (const chunkPath of chunkPaths) {
        await ExpoFS.deleteAsync(toFileUri(chunkPath), { idempotent: true }).catch(() => {})
      }
    }
  }

  private webdavAuth(): string {
    return `Basic ${btoa(`${this.config.accessKey}:${this.config.secretKey}`)}`
  }

  private webdavFileUrl(rel: string): string {
    const baseUrl = (this.config.webdavUrl || '').replace(/\/$/, '')
    const remotePath = this.basePath() + rel
    return `${baseUrl}/${remotePath.replace(/^\//, '')}`
  }

  /** WebDAV 需先创建父目录；S3 按对象 Key 直传，无需此步骤 */
  private async ensureWebDavDirs(rel: string): Promise<void> {
    const baseUrl = (this.config.webdavUrl || '').replace(/\/$/, '')
    const auth = this.webdavAuth()
    const remoteFilePath = (this.basePath() + rel).replace(/^\//, '')
    const parentPath = remoteFilePath.replace(/\/[^/]+$/, '')
    if (!parentPath) return

    const segments = parentPath.split('/').filter(Boolean)
    let current = ''
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment
      const res = await fetch(`${baseUrl}/${current}`, {
        method: 'MKCOL',
        headers: { Authorization: auth }
      })
      if (res.ok || res.status === 405 || res.status === 409) continue
      throw new Error(`WebDAV MKCOL failed for ${current}: ${res.status}`)
    }
  }

  private async getWebDavRemoteSize(rel: string): Promise<number> {
    const res = await fetch(this.webdavFileUrl(rel), {
      method: 'PROPFIND',
      headers: {
        Authorization: this.webdavAuth(),
        Depth: '0',
        'Content-Type': 'application/xml'
      }
    })
    if (!res.ok) return 0
    const xml = await res.text()
    const match = xml.match(
      /<(?:[^:]*:)?getcontentlength>(\d+)<\/(?:[^:]*:)?getcontentlength>/i
    )
    return match?.[1] ? parseInt(match[1], 10) : 0
  }

  private async assembleChunkFilesInSandbox(chunkPaths: string[], destPath: string) {
    const destUri = toFileUri(destPath)
    for (let i = 0; i < chunkPaths.length; i++) {
      const b64 = await ExpoFS.readAsStringAsync(toFileUri(chunkPaths[i]!), {
        encoding: ExpoFS.EncodingType.Base64
      })
      await ExpoFS.writeAsStringAsync(destUri, b64, {
        encoding: ExpoFS.EncodingType.Base64,
        append: i > 0
      })
    }
  }

  private async verifyWebDavUpload(rel: string, expectedSize: number): Promise<void> {
    const remoteSize = await this.getWebDavRemoteSize(rel)
    if (remoteSize !== expectedSize) {
      throw new Error(`WebDAV upload size mismatch: expected ${expectedSize}, got ${remoteSize}`)
    }
  }

  private async uploadWebDav(rel: string, localFilePath: string) {
    await this.ensureWebDavDirs(rel)
    const stat = await this.fileSystem.stat(localFilePath)
    const fileSize = stat.size ?? 0
    if (fileSize <= INCREMENTAL_SYNC_CHUNK_SIZE) {
      await this.uploadWebDavSingle(rel, localFilePath)
      await this.verifyWebDavUpload(rel, fileSize)
      return
    }
    try {
      await this.uploadWebDavChunked(rel, localFilePath, fileSize)
      await this.verifyWebDavUpload(rel, fileSize)
    } catch {
      await this.uploadWebDavSingle(rel, localFilePath)
      await this.verifyWebDavUpload(rel, fileSize)
    }
  }

  private async uploadWebDavSingle(rel: string, localFilePath: string) {
    const response = await uploadAsync(this.webdavFileUrl(rel), localFilePath, {
      httpMethod: 'PUT',
      headers: { Authorization: this.webdavAuth() },
      uploadType: FileSystemUploadType.BINARY_CONTENT
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`WebDAV upload failed: ${response.status}`)
    }
  }

  private async uploadWebDavChunked(rel: string, localFilePath: string, fileSize: number) {
    const url = this.webdavFileUrl(rel)
    const auth = this.webdavAuth()
    const chunkConcurrency = this.config.chunkConcurrency ?? 5

    const firstSize = Math.min(INCREMENTAL_SYNC_CHUNK_SIZE, fileSize)
    const firstBody = await this.readFileChunk(localFilePath, 0, firstSize)
    const firstRes = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(firstSize)
      },
      body: firstBody
    })
    if (!firstRes.ok) {
      throw new Error(`WebDAV upload failed: ${firstRes.status}`)
    }

    const totalParts = Math.ceil(fileSize / INCREMENTAL_SYNC_CHUNK_SIZE)
    if (totalParts <= 1) return

    const restParts = Array.from({ length: totalParts - 1 }, (_, i) => i + 2)
    await limitExecute(restParts, chunkConcurrency, async (partNumber) => {
      const start = (partNumber - 1) * INCREMENTAL_SYNC_CHUNK_SIZE
      const chunkSize = Math.min(INCREMENTAL_SYNC_CHUNK_SIZE, fileSize - start)
      const end = start + chunkSize - 1
      const body = await this.readFileChunk(localFilePath, start, chunkSize)

      const sabreRes = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/x-sabredav-partialupdate',
          'Content-Length': String(chunkSize),
          'X-Update-Range': `bytes=${start}-${end}`
        },
        body
      })
      if (sabreRes.ok) return

      const apacheRes = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/*`
        },
        body
      })
      if (!apacheRes.ok) {
        throw new Error(`WebDAV partial upload part ${partNumber} failed: ${apacheRes.status}`)
      }
    })
  }

  private async downloadWebDav(rel: string, localDestPath: string) {
    const fileSize = await this.getWebDavRemoteSize(rel)
    if (fileSize <= INCREMENTAL_SYNC_CHUNK_SIZE) {
      await this.downloadWebDavSingle(rel, localDestPath)
      return
    }
    try {
      await this.downloadWebDavChunked(rel, localDestPath, fileSize)
    } catch {
      await this.downloadWebDavSingle(rel, localDestPath)
    }
  }

  private async downloadWebDavSingle(rel: string, localDestPath: string) {
    const res = await downloadAsync(this.webdavFileUrl(rel), localDestPath, {
      headers: { Authorization: this.webdavAuth() }
    })
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`WebDAV download failed: ${res.status}`)
    }
  }

  private async downloadWebDavChunked(rel: string, localDestPath: string, fileSize: number) {
    const url = this.webdavFileUrl(rel)
    const auth = this.webdavAuth()
    const chunkConcurrency = this.config.chunkConcurrency ?? 5
    const totalParts = Math.ceil(fileSize / INCREMENTAL_SYNC_CHUNK_SIZE)
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1)
    const cachePrefix = `${getAppCacheDirectory()}wdav_${Date.now()}_`

    const chunkPaths = await limitExecute(partNumbers, chunkConcurrency, async (partNumber) => {
      const start = (partNumber - 1) * INCREMENTAL_SYNC_CHUNK_SIZE
      const end = Math.min(start + INCREMENTAL_SYNC_CHUNK_SIZE, fileSize) - 1
      const chunkPath = `${cachePrefix}part_${partNumber}`
      const res = await fetch(url, {
        headers: {
          Authorization: auth,
          Range: `bytes=${start}-${end}`
        }
      })
      if (res.status !== 206) {
        throw new Error(`WebDAV range download requires 206, got ${res.status}`)
      }
      const b64 = arrayBufferToBase64(await res.arrayBuffer())
      await ExpoFS.writeAsStringAsync(toFileUri(chunkPath), b64, {
        encoding: ExpoFS.EncodingType.Base64
      })
      return chunkPath
    })

    try {
      await this.assembleChunkFilesInSandbox(chunkPaths, localDestPath)
    } finally {
      for (const chunkPath of chunkPaths) {
        await ExpoFS.deleteAsync(toFileUri(chunkPath), { idempotent: true }).catch(() => {})
      }
    }
  }
}
