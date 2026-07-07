import {
  formatWebDavRequestError,
  INCREMENTAL_SYNC_CHUNK_SIZE,
  isManagedIncrementalZipPath,
  limitExecute,
  parseWebDavPropfindEntries,
  toRelativeWebDavPath,
  WEBDAV_SHALLOW_LIST_CONCURRENCY
} from '@baishou/shared'
import * as ExpoFS from 'expo-file-system/legacy'
import { toFileUri } from './android-external-fs'
import { getAppCacheDirectory } from './mobile-app-paths'
import { FileSystemUploadType, downloadAsync, uploadAsync } from './mobile-http-transfer'
import { createPartProgressReporter } from './mobile-incremental-sync-progress.util'
import {
  canHttpUploadSyncFileFromPath,
  httpUploadSyncFile,
  readSyncFileChunk
} from './mobile-sync-file-read.util'
import {
  isIncrementalSyncAbortedError,
  IncrementalSyncAbortedError
} from './mobile-incremental-sync-abort.util'
import { isTransientNetworkError } from '../utils/transient-network-error.util'
import {
  arrayBufferToBase64,
  mobileSyncDownloadPartSize,
  MOBILE_SYNC_PROGRESS_CHUNK_THRESHOLD,
  type IncrementalCloudOpsHost,
  type IncrementalSyncRecord
} from './mobile-incremental-cloud-ops.types'

function isNativeUploadAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (isIncrementalSyncAbortedError(error)) return true
  if (signal?.aborted) return true
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return /canceled|cancelled|HTTP upload canceled/i.test(message)
}

function rethrowUnlessTransientNativeUploadError(error: unknown, signal?: AbortSignal): void {
  if (isNativeUploadAbortError(error, signal)) {
    throw new IncrementalSyncAbortedError()
  }
  if (!isTransientNetworkError(error)) throw error
}

function webdavBaseUrl(host: IncrementalCloudOpsHost): string {
  let safeUrl = (host.config.webdavUrl || '').trim()
  if (!safeUrl) safeUrl = 'http://localhost'
  if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
    safeUrl = `https://${safeUrl}`
  }
  return safeUrl.replace(/\/$/, '')
}

function resolveWebDavUrl(host: IncrementalCloudOpsHost, href: string): string {
  const decoded = decodeURIComponent(href.trim())
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
    return decoded
  }
  if (decoded.startsWith('/')) {
    const origin = new URL(webdavBaseUrl(host)).origin
    return `${origin}${decoded}`
  }
  return `${webdavBaseUrl(host)}/${decoded.replace(/^\//, '')}`
}

async function webdavPropfind(
  host: IncrementalCloudOpsHost,
  url: string,
  depth: '0' | '1'
): Promise<string> {
  const response = await host.fetchWithAbort(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: host.webdavAuth(),
      Depth: depth,
      'Content-Type': 'application/xml'
    }
  })
  if (!response.ok) {
    throw new Error(formatWebDavRequestError('列举目录', response.status, response.statusText))
  }
  return response.text()
}

async function ensureWebDavBasePath(host: IncrementalCloudOpsHost): Promise<void> {
  const prefix = host.basePath().replace(/\/$/, '')
  if (!prefix) return
  const segments = prefix.split('/').filter(Boolean)
  if (segments.length === 0) return

  const baseUrl = webdavBaseUrl(host)
  const auth = host.webdavAuth()
  let current = ''
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment
    const res = await host.fetchWithAbort(`${baseUrl}/${current}`, {
      method: 'MKCOL',
      headers: { Authorization: auth }
    })
    if (res.ok || res.status === 405 || res.status === 409) continue
    throw new Error(formatWebDavRequestError(`创建目录 ${current}`, res.status, res.statusText))
  }
}

/**
 * 逐目录 Depth:1 PROPFIND，与桌面端一致；避免 Depth: infinity 在部分网盘/NAS 上 403。
 */
async function collectWebDavShallow(
  host: IncrementalCloudOpsHost,
  remoteUrl: string,
  records: IncrementalSyncRecord[]
): Promise<void> {
  const normalizedCurrent = remoteUrl.replace(/\/$/, '')
  let xml: string
  try {
    xml = await webdavPropfind(host, remoteUrl, '1')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('HTTP 404')) return
    throw e
  }

  const subdirs: string[] = []
  const basePrefix = host.basePath().replace(/\/$/, '')

  for (const entry of parseWebDavPropfindEntries(xml)) {
    const entryUrl = resolveWebDavUrl(host, entry.href).replace(/\/$/, '')

    if (entry.isCollection) {
      if (entryUrl !== normalizedCurrent) {
        subdirs.push(entryUrl)
      }
      continue
    }

    const relativeName = toRelativeWebDavPath(entry.href, basePrefix)
    if (!relativeName) continue

    records.push({
      filename: relativeName,
      lastModified: new Date(),
      sizeInBytes: 0,
      managed: isManagedIncrementalZipPath(relativeName)
    })
  }

  await limitExecute(subdirs, WEBDAV_SHALLOW_LIST_CONCURRENCY, async (dirUrl) => {
    await collectWebDavShallow(host, dirUrl, records)
  })
}

export async function listWebDav(host: IncrementalCloudOpsHost): Promise<IncrementalSyncRecord[]> {
  await ensureWebDavBasePath(host)

  const records: IncrementalSyncRecord[] = []
  const baseDir = host.basePath().replace(/\/$/, '')
  const rootUrl = baseDir ? `${webdavBaseUrl(host)}/${baseDir}` : webdavBaseUrl(host)

  try {
    await collectWebDavShallow(host, rootUrl, records)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('HTTP 404')) return []
    throw e
  }

  return records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
}

async function ensureWebDavDirs(host: IncrementalCloudOpsHost, rel: string): Promise<void> {
  const baseUrl = (host.config.webdavUrl || '').replace(/\/$/, '')
  const auth = host.webdavAuth()
  const remoteFilePath = (host.basePath() + rel).replace(/^\//, '')
  const parentPath = remoteFilePath.replace(/\/[^/]+$/, '')
  if (!parentPath) return

  const segments = parentPath.split('/').filter(Boolean)
  let current = ''
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment
    const res = await host.fetchWithAbort(`${baseUrl}/${current}`, {
      method: 'MKCOL',
      headers: { Authorization: auth }
    })
    if (res.ok || res.status === 405 || res.status === 409) continue
    throw new Error(`WebDAV MKCOL failed for ${current}: ${res.status}`)
  }
}

async function getWebDavRemoteSize(host: IncrementalCloudOpsHost, rel: string): Promise<number> {
  const res = await host.fetchWithAbort(host.webdavFileUrl(rel), {
    method: 'PROPFIND',
    headers: {
      Authorization: host.webdavAuth(),
      Depth: '0',
      'Content-Type': 'application/xml'
    }
  })
  if (!res.ok) return 0
  const xml = await res.text()
  const match = xml.match(/<(?:[^:]*:)?getcontentlength>(\d+)<\/(?:[^:]*:)?getcontentlength>/i)
  return match?.[1] ? parseInt(match[1], 10) : 0
}

async function assembleChunkFilesInSandbox(
  host: IncrementalCloudOpsHost,
  chunkPaths: string[],
  destPath: string
) {
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

async function verifyWebDavUpload(
  host: IncrementalCloudOpsHost,
  rel: string,
  expectedSize: number
): Promise<void> {
  const remoteSize = await getWebDavRemoteSize(host, rel)
  if (remoteSize !== expectedSize) {
    throw new Error(`WebDAV upload size mismatch: expected ${expectedSize}, got ${remoteSize}`)
  }
}

async function tryNativeWebDavUpload(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string,
  fileSize: number
): Promise<boolean> {
  if (!canHttpUploadSyncFileFromPath() || fileSize <= 0) return false
  try {
    host.reportActivity('uploading', localFilePath)
    const response = await httpUploadSyncFile(
      host.webdavFileUrl(rel),
      localFilePath,
      'PUT',
      { Authorization: host.webdavAuth() },
      (written, total) => {
        host.reportTransfer(written, total > 0 ? total : fileSize, localFilePath)
      },
      host.abortSignal
    )
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`WebDAV upload failed: ${response.status}`)
    }
    host.reportTransfer(fileSize, fileSize, localFilePath)
    return true
  } catch (error) {
    rethrowUnlessTransientNativeUploadError(error, host.abortSignal)
    return false
  }
}

async function uploadWebDavSingleWithUploadAsync(
  host: IncrementalCloudOpsHost,
  rel: string,
  uploadUri: string,
  fileSize: number,
  localFilePath: string
) {
  const response = await host.transferWithAbort(() =>
    uploadAsync(host.webdavFileUrl(rel), uploadUri, {
      httpMethod: 'PUT',
      headers: { Authorization: host.webdavAuth() },
      uploadType: FileSystemUploadType.BINARY_CONTENT
    })
  )
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`WebDAV upload failed: ${response.status}`)
  }
  host.reportTransfer(fileSize, fileSize, localFilePath)
}

async function uploadWebDavSingleWithFetch(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string
) {
  const stat = await host.fileSystem.stat(localFilePath)
  const fileSize = stat.size ?? 0
  if (fileSize <= 0) {
    throw new Error(`WebDAV upload skipped empty file: ${rel}`)
  }
  const body = await readSyncFileChunk(localFilePath, 0, fileSize)
  const response = await host.fetchWithAbort(host.webdavFileUrl(rel), {
    method: 'PUT',
    headers: {
      Authorization: host.webdavAuth(),
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(fileSize)
    },
    body
  })
  if (!response.ok) {
    throw new Error(`WebDAV upload failed: ${response.status}`)
  }
  host.reportTransfer(fileSize, fileSize, localFilePath)
}

async function uploadWebDavSingle(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string,
  fileSize: number
) {
  if (await tryNativeWebDavUpload(host, rel, localFilePath, fileSize)) {
    return
  }
  const uploadUri = toFileUri(localFilePath)
  try {
    await uploadWebDavSingleWithUploadAsync(host, rel, uploadUri, fileSize, localFilePath)
    return
  } catch (error) {
    if (!isTransientNetworkError(error)) throw error
  }
  await uploadWebDavSingleWithFetch(host, rel, localFilePath)
}

async function uploadWebDavChunked(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string,
  fileSize: number
) {
  const url = host.webdavFileUrl(rel)
  const auth = host.webdavAuth()
  const chunkConcurrency = host.config.chunkConcurrency ?? 5

  const firstSize = Math.min(INCREMENTAL_SYNC_CHUNK_SIZE, fileSize)
  const firstBody = await readSyncFileChunk(localFilePath, 0, firstSize)
  const firstRes = await host.fetchWithAbort(url, {
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
  host.reportTransfer(firstSize, fileSize, localFilePath)

  const totalParts = Math.ceil(fileSize / INCREMENTAL_SYNC_CHUNK_SIZE)
  if (totalParts <= 1) return

  const restParts = Array.from({ length: totalParts - 1 }, (_, i) => i + 2)
  const reportPart = createPartProgressReporter(totalParts, fileSize, (done, total) => {
    host.reportTransfer(done, total, localFilePath)
  })
  reportPart(0, firstSize)

  await limitExecute(restParts, chunkConcurrency, async (partNumber) => {
    const start = (partNumber - 1) * INCREMENTAL_SYNC_CHUNK_SIZE
    const chunkSize = Math.min(INCREMENTAL_SYNC_CHUNK_SIZE, fileSize - start)
    const end = start + chunkSize - 1
    const body = await readSyncFileChunk(localFilePath, start, chunkSize)

    const sabreRes = await host.fetchWithAbort(url, {
      method: 'PATCH',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-sabredav-partialupdate',
        'Content-Length': String(chunkSize),
        'X-Update-Range': `bytes=${start}-${end}`
      },
      body
    })
    if (sabreRes.ok) {
      reportPart(partNumber - 1, chunkSize)
      return
    }

    const apacheRes = await host.fetchWithAbort(url, {
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
    reportPart(partNumber - 1, chunkSize)
  })
}

export async function uploadWebDav(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string
): Promise<void> {
  await ensureWebDavDirs(host, rel)
  const stat = await host.fileSystem.stat(localFilePath)
  const fileSize = stat.size ?? 0
  host.reportActivity('uploading', localFilePath)
  host.reportTransfer(0, fileSize, localFilePath)
  if (fileSize <= INCREMENTAL_SYNC_CHUNK_SIZE) {
    await uploadWebDavSingle(host, rel, localFilePath, fileSize)
    await verifyWebDavUpload(host, rel, fileSize)
    return
  }
  try {
    await uploadWebDavChunked(host, rel, localFilePath, fileSize)
    await verifyWebDavUpload(host, rel, fileSize)
  } catch {
    await uploadWebDavSingle(host, rel, localFilePath, fileSize)
    await verifyWebDavUpload(host, rel, fileSize)
  }
}

async function downloadWebDavSingle(
  host: IncrementalCloudOpsHost,
  rel: string,
  localDestPath: string,
  fileSize: number,
  progressDestPath: string
) {
  const res = await host.transferWithAbort(() =>
    downloadAsync(host.webdavFileUrl(rel), localDestPath, {
      headers: { Authorization: host.webdavAuth() }
    })
  )
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`WebDAV download failed: ${res.status}`)
  }
  if (fileSize > 0) {
    host.reportTransfer(fileSize, fileSize, progressDestPath)
  }
}

async function downloadWebDavChunked(
  host: IncrementalCloudOpsHost,
  rel: string,
  localDestPath: string,
  fileSize: number,
  progressDestPath: string
) {
  const url = host.webdavFileUrl(rel)
  const auth = host.webdavAuth()
  const chunkConcurrency = host.config.chunkConcurrency ?? 5
  const partSize = mobileSyncDownloadPartSize(fileSize, INCREMENTAL_SYNC_CHUNK_SIZE)
  const totalParts = Math.ceil(fileSize / partSize)
  const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1)
  const cachePrefix = `${getAppCacheDirectory()}wdav_${Date.now()}_`
  const reportPart = createPartProgressReporter(totalParts, fileSize, (done, total) => {
    host.reportTransfer(done, total, progressDestPath)
  })

  const chunkPaths = await limitExecute(partNumbers, chunkConcurrency, async (partNumber) => {
    const start = (partNumber - 1) * partSize
    const end = Math.min(start + partSize, fileSize) - 1
    const chunkPath = `${cachePrefix}part_${partNumber}`
    const res = await host.fetchWithAbort(url, {
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
    reportPart(partNumber - 1, end - start + 1)
    return chunkPath
  })

  try {
    await assembleChunkFilesInSandbox(host, chunkPaths, localDestPath)
  } finally {
    for (const chunkPath of chunkPaths) {
      await ExpoFS.deleteAsync(toFileUri(chunkPath), { idempotent: true }).catch(() => {})
    }
  }
}

export async function downloadWebDav(
  host: IncrementalCloudOpsHost,
  rel: string,
  localDestPath: string,
  progressDestPath: string
): Promise<void> {
  host.reportActivity('preparing', progressDestPath)
  const fileSize = await getWebDavRemoteSize(host, rel)
  host.reportActivity('downloading', progressDestPath)
  host.reportTransfer(0, fileSize, progressDestPath)
  if (fileSize <= 0) {
    await downloadWebDavSingle(host, rel, localDestPath, fileSize, progressDestPath)
    return
  }
  if (fileSize <= MOBILE_SYNC_PROGRESS_CHUNK_THRESHOLD) {
    await downloadWebDavSingle(host, rel, localDestPath, fileSize, progressDestPath)
    return
  }
  try {
    await downloadWebDavChunked(host, rel, localDestPath, fileSize, progressDestPath)
  } catch {
    await downloadWebDavSingle(host, rel, localDestPath, fileSize, progressDestPath)
  }
}
