import * as FileSystem from 'expo-file-system/legacy'
import { signS3Request, type S3SyncConfig } from '@baishou/shared'

export type IncrementalSyncRecord = {
  filename: string
  lastModified: Date
  sizeInBytes: number
  managed: boolean
}

/** 增量同步用云客户端（S3 / WebDAV），保留 vault 相对路径 */
export class MobileIncrementalCloudClient {
  private vaultPath: string | null = null

  constructor(private config: S3SyncConfig) {}

  setVaultPath(vaultPath: string) {
    this.vaultPath = vaultPath
  }

  private basePath(): string {
    let p = this.config.path?.replace(/^\//, '') || 'backup_sync'
    if (p && !p.endsWith('/')) p += '/'
    return p
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

  async listFiles(): Promise<IncrementalSyncRecord[]> {
    if (this.config.target === 'webdav') {
      return this.listWebDav()
    }
    return this.listS3()
  }

  async uploadFile(localFilePath: string): Promise<void> {
    const rel = this.relFromLocal(localFilePath)
    if (this.config.target === 'webdav') {
      await this.uploadWebDav(rel, localFilePath)
    } else {
      await this.uploadS3(rel, localFilePath)
    }
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const parent = localDestPath.replace(/\/[^/]+$/, '')
    const info = await FileSystem.getInfoAsync(parent)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(parent, { intermediates: true })
    }
    if (this.config.target === 'webdav') {
      await this.downloadWebDav(remoteFilename, localDestPath)
    } else {
      await this.downloadS3(remoteFilename, localDestPath)
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
    const uri = new URL(this.config.endpoint || 'http://localhost')
    const usePathStyle =
      uri.hostname.includes('localhost') || uri.hostname.includes('127.0.0.1')
    const objectName = this.basePath() + remoteFilename
    const url = usePathStyle
      ? `${uri.protocol}//${uri.hostname}${uri.port ? ':' + uri.port : ''}/${this.config.bucket}/${objectName}`
      : `${uri.protocol}//${this.config.bucket}.${uri.hostname}${uri.port ? ':' + uri.port : ''}/${objectName}`
    const headers = await signS3Request(
      'DELETE',
      url,
      this.config.region || 'us-east-1',
      this.config.accessKey || '',
      this.config.secretKey || '',
      null
    )
    const res = await fetch(url, { method: 'DELETE', headers })
    if (!res.ok && res.status !== 404) {
      throw new Error(`S3 delete failed: ${res.status}`)
    }
  }

  private async listS3(): Promise<IncrementalSyncRecord[]> {
    const uri = new URL(this.config.endpoint || 'http://localhost')
    const usePathStyle =
      uri.hostname.includes('localhost') || uri.hostname.includes('127.0.0.1')
    const prefix = this.basePath()
    const listUrl = usePathStyle
      ? `${uri.protocol}//${uri.hostname}${uri.port ? ':' + uri.port : ''}/${this.config.bucket}?list-type=2&prefix=${encodeURIComponent(prefix)}`
      : `${uri.protocol}//${this.config.bucket}.${uri.hostname}${uri.port ? ':' + uri.port : ''}/?list-type=2&prefix=${encodeURIComponent(prefix)}`

    const headers = await signS3Request(
      'GET',
      listUrl,
      this.config.region || 'us-east-1',
      this.config.accessKey || '',
      this.config.secretKey || '',
      null
    )
    const response = await fetch(listUrl, { method: 'GET', headers })
    if (!response.ok) throw new Error(`S3 list failed: ${response.status}`)
    const xml = await response.text()
    const records: IncrementalSyncRecord[] = []
    const keyRegex = /<Key>([^<]+)<\/Key>/g
    const lmRegex = /<LastModified>([^<]+)<\/LastModified>/g
    const sizeRegex = /<Size>(\d+)<\/Size>/g
    let m: RegExpExecArray | null
    const keys: string[] = []
    while ((m = keyRegex.exec(xml))) {
      keys.push(m[1]!)
    }
    const lms = [...xml.matchAll(/<LastModified>([^<]+)<\/LastModified>/g)].map((x) => x[1])
    const sizes = [...xml.matchAll(/<Size>(\d+)<\/Size>/g)].map((x) => parseInt(x[1]!, 10))

    keys.forEach((key, i) => {
      if (key.endsWith('/')) return
      let rel = key
      if (rel.startsWith(prefix)) rel = rel.slice(prefix.length)
      records.push({
        filename: rel,
        lastModified: new Date(lms[i] || Date.now()),
        sizeInBytes: sizes[i] || 0,
        managed: /^BaiShou_.*\.zip$/i.test(rel)
      })
    })
    return records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  }

  private async listWebDav(): Promise<IncrementalSyncRecord[]> {
    const baseUrl = (this.config.webdavUrl || '').replace(/\/$/, '')
    const basePath = this.config.path?.startsWith('/') ? this.config.path : `/${this.config.path || ''}`
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
    const uri = new URL(this.config.endpoint || 'http://localhost')
    const usePathStyle =
      uri.hostname.includes('localhost') || uri.hostname.includes('127.0.0.1')
    const objectName = this.basePath() + rel
    const url = usePathStyle
      ? `${uri.protocol}//${uri.hostname}${uri.port ? ':' + uri.port : ''}/${this.config.bucket}/${objectName}`
      : `${uri.protocol}//${this.config.bucket}.${uri.hostname}${uri.port ? ':' + uri.port : ''}/${objectName}`
    const headers = await signS3Request(
      'PUT',
      url,
      this.config.region || 'us-east-1',
      this.config.accessKey || '',
      this.config.secretKey || '',
      null
    )
    const response = await FileSystem.uploadAsync(url, localFilePath, {
      httpMethod: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/octet-stream' },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`S3 upload failed: ${response.status}`)
    }
  }

  private async uploadWebDav(rel: string, localFilePath: string) {
    const baseUrl = (this.config.webdavUrl || '').replace(/\/$/, '')
    const remotePath = this.basePath() + rel
    const auth = `Basic ${btoa(`${this.config.accessKey}:${this.config.secretKey}`)}`
    const response = await FileSystem.uploadAsync(`${baseUrl}/${remotePath.replace(/^\//, '')}`, localFilePath, {
      httpMethod: 'PUT',
      headers: { Authorization: auth },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`WebDAV upload failed: ${response.status}`)
    }
  }

  private async downloadS3(rel: string, localDestPath: string) {
    const uri = new URL(this.config.endpoint || 'http://localhost')
    const usePathStyle =
      uri.hostname.includes('localhost') || uri.hostname.includes('127.0.0.1')
    const objectName = this.basePath() + rel
    const url = usePathStyle
      ? `${uri.protocol}//${uri.hostname}${uri.port ? ':' + uri.port : ''}/${this.config.bucket}/${objectName}`
      : `${uri.protocol}//${this.config.bucket}.${uri.hostname}${uri.port ? ':' + uri.port : ''}/${objectName}`
    const headers = await signS3Request(
      'GET',
      url,
      this.config.region || 'us-east-1',
      this.config.accessKey || '',
      this.config.secretKey || '',
      null
    )
    const res = await FileSystem.downloadAsync(url, localDestPath, { headers })
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`S3 download failed: ${res.status}`)
    }
  }

  private async downloadWebDav(rel: string, localDestPath: string) {
    const baseUrl = (this.config.webdavUrl || '').replace(/\/$/, '')
    const remotePath = this.basePath() + rel
    const auth = `Basic ${btoa(`${this.config.accessKey}:${this.config.secretKey}`)}`
    const res = await FileSystem.downloadAsync(
      `${baseUrl}/${remotePath.replace(/^\//, '')}`,
      localDestPath,
      { headers: { Authorization: auth } }
    )
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`WebDAV download failed: ${res.status}`)
    }
  }
}
