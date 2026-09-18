import { INCREMENTAL_SYNC_CHUNK_SIZE, limitExecute } from '@baishou/shared'
import * as ExpoFS from 'expo-file-system/legacy'
import { toFileUri } from './android-external-fs'
import { getAppCacheDirectory } from './mobile-app-paths'
import { downloadAsync } from './mobile-http-transfer'
import { createPartProgressReporter } from './mobile-incremental-sync-progress.util'
import {
  arrayBufferToBase64,
  mobileSyncDownloadPartSize,
  MOBILE_SYNC_PROGRESS_CHUNK_THRESHOLD,
  type IncrementalCloudOpsHost
} from './mobile-incremental-cloud-ops.types'
import { getWebDavRemoteSize } from './mobile-incremental-cloud-webdav.size'

async function assembleChunkFilesInSandbox(
  _host: IncrementalCloudOpsHost,
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
