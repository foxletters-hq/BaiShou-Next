/* eslint-disable max-lines -- WebDAV 运维操作集中于此，后续再拆分 */
import i18n from 'i18next'
import {
  describeWebDavTarget,
  formatWebDavRequestError,
  INCREMENTAL_SYNC_CHUNK_SIZE,
  isManagedIncrementalZipPath,
  isStrictWebDavChildUrl,
  isTransientWebDavHttpStatus,
  limitExecute,
  normalizeWebDavListingUrl,
  parseWebDavPropfindEntries,
  resolveWebDavListingUrl,
  rewriteWebDavUrlOrigin,
  suggestWebDavHttpFallbackUrl,
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
import { rethrowUnlessTransientNativeUploadError } from './mobile-incremental-sync-abort.util'
import { isTransientNetworkError } from '../utils/transient-network-error.util'
import {
  arrayBufferToBase64,
  mobileSyncDownloadPartSize,
  MOBILE_SYNC_PROGRESS_CHUNK_THRESHOLD,
  type IncrementalCloudOpsHost,
  type IncrementalSyncRecord
} from './mobile-incremental-cloud-ops.types'

function webdavBaseUrl(host: IncrementalCloudOpsHost): string {
  return host.webdavConfiguredBaseUrl()
}

/** 同一 host 上已确保存在的目录，避免并发上传重复 MKCOL 触发网盘 503 */
const ensuredWebDavDirsByHost = new WeakMap<object, Set<string>>()
const pendingWebDavMkcolByHost = new WeakMap<object, Map<string, Promise<void>>>()

const MKCOL_OK = new Set([200, 201, 204, 405, 409])
const MKCOL_MAX_ATTEMPTS = 4

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function mkcolOnce(
  host: IncrementalCloudOpsHost,
  dirUrl: string,
  auth: string
): Promise<number> {
  const res = await host.fetchWithAbort(dirUrl, {
    method: 'MKCOL',
    headers: { Authorization: auth }
  })
  return res.status
}

/**
 * 逐级 MKCOL；对 429/5xx 退避重试，并合并同一路径的并发请求。
 */
async function ensureWebDavPathSegments(
  host: IncrementalCloudOpsHost,
  segments: string[]
): Promise<void> {
  if (segments.length === 0) return

  const baseUrl = webdavBaseUrl(host)
  const auth = host.webdavAuth()
  let ensured = ensuredWebDavDirsByHost.get(host)
  if (!ensured) {
    ensured = new Set()
    ensuredWebDavDirsByHost.set(host, ensured)
  }
  let pending = pendingWebDavMkcolByHost.get(host)
  if (!pending) {
    pending = new Map()
    pendingWebDavMkcolByHost.set(host, pending)
  }

  let current = ''
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment
    if (ensured.has(current)) continue

    const inflight = pending.get(current)
    if (inflight) {
      await inflight
      continue
    }

    const pathForError = current
    const run = (async () => {
      const dirUrl = `${baseUrl}/${pathForError}`
      let lastStatus = 0
      for (let attempt = 0; attempt < MKCOL_MAX_ATTEMPTS; attempt++) {
        lastStatus = await mkcolOnce(host, dirUrl, auth)
        if (MKCOL_OK.has(lastStatus)) {
          ensured!.add(pathForError)
          return
        }
        if (!isTransientWebDavHttpStatus(lastStatus) || attempt >= MKCOL_MAX_ATTEMPTS - 1) {
          break
        }
        await sleepMs(400 * 2 ** attempt)
      }
      throw new Error(
        formatWebDavRequestError(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.L110',
            '创建目录 {{path}}',
            { path: pathForError }
          ),
          lastStatus
        )
      )
    })()

    pending.set(current, run)
    try {
      await run
    } finally {
      pending.delete(current)
    }
  }
}

function resolveWebDavUrl(
  host: IncrementalCloudOpsHost,
  href: string,
  options?: { asCollection?: boolean }
): string {
  return resolveWebDavListingUrl(webdavBaseUrl(host), href, options)
}

async function propfindOnce(
  host: IncrementalCloudOpsHost,
  requestUrl: string,
  depth: '0' | '1'
): Promise<Response> {
  // 与 1.2.13 保持一致：不强制尾斜杠、不强制 PROPFIND body（群晖对这两点更敏感）
  return host.fetchWithAbort(requestUrl, {
    method: 'PROPFIND',
    headers: {
      Authorization: host.webdavAuth(),
      Depth: depth,
      'Content-Type': 'application/xml'
    }
  })
}

async function webdavPropfind(
  host: IncrementalCloudOpsHost,
  url: string,
  depth: '0' | '1'
): Promise<string> {
  // 保留调用方传入的 URL 形态（1.2.13 不对 collection 强行补 `/`）
  const requestUrl = url.replace(/\/+$/, '') || url
  console.warn('[IncrementalSync][WebDAV] propfind', {
    target: describeWebDavTarget(requestUrl),
    depth
  })

  let response: Response
  try {
    response = await propfindOnce(host, requestUrl, depth)
  } catch (e) {
    if (!isTransientNetworkError(e)) throw e

    const fallbackBase = suggestWebDavHttpFallbackUrl(webdavBaseUrl(host))
    if (!fallbackBase || fallbackBase === webdavBaseUrl(host)) {
      console.warn('[IncrementalSync][WebDAV] propfind-network-failed', {
        target: describeWebDavTarget(requestUrl),
        message: e instanceof Error ? e.message : String(e)
      })
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.network_failed',
          'WebDAV 列举失败：无法连接服务器。若使用群晖/NAS，请优先试 http://内网IP:5005；HTTPS 自签证书需在系统中安装并信任，或改用已信任证书。当前目标：{{target}}',
          { target: describeWebDavTarget(requestUrl) }
        )
      )
    }

    const fallbackUrl = rewriteWebDavUrlOrigin(requestUrl, fallbackBase).replace(/\/+$/, '')
    console.warn('[IncrementalSync][WebDAV] propfind-http-fallback', {
      from: describeWebDavTarget(requestUrl),
      to: describeWebDavTarget(fallbackUrl)
    })
    host.adoptWebDavBaseUrl(fallbackBase)

    try {
      response = await propfindOnce(host, fallbackUrl, depth)
    } catch (retryError) {
      console.warn('[IncrementalSync][WebDAV] propfind-fallback-failed', {
        target: describeWebDavTarget(fallbackUrl),
        message: retryError instanceof Error ? retryError.message : String(retryError)
      })
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.network_failed',
          'WebDAV 列举失败：无法连接服务器。若使用群晖/NAS，请优先试 http://内网IP:5005；HTTPS 自签证书需在系统中安装并信任，或改用已信任证书。当前目标：{{target}}',
          { target: describeWebDavTarget(fallbackUrl) }
        )
      )
    }
  }

  if (!response.ok) {
    throw new Error(
      formatWebDavRequestError(
        i18n.t('auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.L82', '列举目录'),
        response.status,
        response.statusText
      )
    )
  }
  return response.text()
}

async function ensureWebDavBasePath(host: IncrementalCloudOpsHost): Promise<void> {
  const prefix = host.basePath().replace(/\/$/, '')
  if (!prefix) return
  const segments = prefix.split('/').filter(Boolean)
  await ensureWebDavPathSegments(host, segments)
}

/**
 * 逐目录 Depth:1 PROPFIND，与桌面端一致；避免 Depth: infinity 在部分网盘/NAS 上 403。
 * visited：同一轮列举内去重，防止父目录回环 / 尾斜杠变体导致请求风暴。
 */
async function collectWebDavShallow(
  host: IncrementalCloudOpsHost,
  remoteUrl: string,
  records: IncrementalSyncRecord[],
  options: {
    missingOk?: boolean
    visited?: Set<string>
  } = { missingOk: true }
): Promise<void> {
  const visited = options.visited ?? new Set<string>()
  const normalizedCurrent = normalizeWebDavListingUrl(remoteUrl)
  if (!normalizedCurrent || visited.has(normalizedCurrent)) return
  visited.add(normalizedCurrent)

  let xml: string
  try {
    xml = await webdavPropfind(host, normalizedCurrent, '1')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('HTTP 404')) {
      if (options.missingOk !== false) return
      throw new Error(
        formatWebDavRequestError(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.L82',
            '列举目录'
          ),
          404,
          i18n.t(
            'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.prefix_missing',
            '路径前缀不存在（请先确认 URL/目录配置可写后再同步）'
          )
        )
      )
    }
    throw e
  }

  const subdirs: string[] = []
  const basePrefix = host.basePath().replace(/\/$/, '')

  for (const entry of parseWebDavPropfindEntries(xml)) {
    const entryUrl = normalizeWebDavListingUrl(resolveWebDavUrl(host, entry.href))

    if (entry.isCollection) {
      // 只递归严格子目录，忽略自身、父目录、兄弟目录
      if (isStrictWebDavChildUrl(normalizedCurrent, entryUrl) && !visited.has(entryUrl)) {
        subdirs.push(entryUrl)
      }
      continue
    }

    const relativeName = toRelativeWebDavPath(entry.href, basePrefix)
    if (!relativeName) continue

    records.push({
      filename: relativeName,
      lastModified: entry.lastModified ?? new Date(0),
      sizeInBytes: entry.sizeInBytes ?? 0,
      managed: isManagedIncrementalZipPath(relativeName)
    })
  }

  await limitExecute(subdirs, WEBDAV_SHALLOW_LIST_CONCURRENCY, async (dirUrl) => {
    await collectWebDavShallow(host, dirUrl, records, {
      missingOk: true,
      visited
    })
  })
}

export async function listWebDav(host: IncrementalCloudOpsHost): Promise<IncrementalSyncRecord[]> {
  // 列举只读：不在此处 MKCOL，避免对只读账号产生写副作用
  const records: IncrementalSyncRecord[] = []
  const baseDir = host.basePath().replace(/\/$/, '')
  const rootUrl = normalizeWebDavListingUrl(
    baseDir ? `${webdavBaseUrl(host)}/${baseDir}` : webdavBaseUrl(host)
  )
  await collectWebDavShallow(host, rootUrl, records, {
    missingOk: false,
    visited: new Set<string>()
  })
  return records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
}

async function ensureWebDavDirs(host: IncrementalCloudOpsHost, rel: string): Promise<void> {
  const remoteFilePath = (host.basePath() + rel).replace(/^\//, '')
  const parentPath = remoteFilePath.replace(/\/[^/]+$/, '')
  if (!parentPath) return
  await ensureWebDavPathSegments(host, parentPath.split('/').filter(Boolean))
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
  await ensureWebDavBasePath(host)
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
