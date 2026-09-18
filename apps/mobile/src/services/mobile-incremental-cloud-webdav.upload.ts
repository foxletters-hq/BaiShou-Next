import { INCREMENTAL_SYNC_CHUNK_SIZE, limitExecute } from '@baishou/shared'
import { toFileUri } from './android-external-fs'
import { FileSystemUploadType, uploadAsync } from './mobile-http-transfer'
import { createPartProgressReporter } from './mobile-incremental-sync-progress.util'
import {
  canHttpUploadSyncFileFromPath,
  httpUploadSyncFile,
  readSyncFileChunk
} from './mobile-sync-file-read.util'
import { rethrowUnlessTransientNativeUploadError } from './mobile-incremental-sync-abort.util'
import { isTransientNetworkError } from '../utils/transient-network-error.util'
import type { IncrementalCloudOpsHost } from './mobile-incremental-cloud-ops.types'
import { ensureWebDavBasePath, ensureWebDavDirs } from './mobile-incremental-cloud-webdav.mkdir'
import { getWebDavRemoteSize } from './mobile-incremental-cloud-webdav.size'

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
