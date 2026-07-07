import {
  buildS3ObjectUrl,
  INCREMENTAL_SYNC_CHUNK_SIZE,
  limitExecute,
  s3FetchHeaders,
  signS3Request
} from '@baishou/shared'
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

async function getS3RemoteSize(host: IncrementalCloudOpsHost, rel: string): Promise<number> {
  const url = buildS3ObjectUrl(host.s3UrlOptions(rel))
  const signed = await signS3Request(
    'HEAD',
    url,
    host.config.region || 'us-east-1',
    host.config.accessKey || '',
    host.config.secretKey || '',
    null
  )
  const res = await host.fetchWithAbort(url, { method: 'HEAD', headers: s3FetchHeaders(signed) })
  if (!res.ok) return 0
  const cl = res.headers.get('Content-Length')
  return cl ? parseInt(cl, 10) : 0
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

async function downloadS3Single(
  host: IncrementalCloudOpsHost,
  rel: string,
  localDestPath: string,
  fileSize: number,
  progressDestPath: string
) {
  const url = buildS3ObjectUrl({
    endpoint: host.config.endpoint || '',
    bucket: host.config.bucket || '',
    objectKey: host.basePath() + rel
  })
  const signed = await signS3Request(
    'GET',
    url,
    host.config.region || 'us-east-1',
    host.config.accessKey || '',
    host.config.secretKey || '',
    null
  )
  const res = await host.transferWithAbort(() =>
    downloadAsync(url, localDestPath, { headers: s3FetchHeaders(signed) })
  )
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`S3 download failed: ${res.status}`)
  }
  if (fileSize > 0) {
    host.reportTransfer(fileSize, fileSize, progressDestPath)
  }
}

async function downloadS3Chunked(
  host: IncrementalCloudOpsHost,
  rel: string,
  localDestPath: string,
  fileSize: number,
  progressDestPath: string
) {
  const urlOpts = host.s3UrlOptions(rel)
  const url = buildS3ObjectUrl(urlOpts)
  const region = host.config.region || 'us-east-1'
  const accessKey = host.config.accessKey || ''
  const secretKey = host.config.secretKey || ''
  const chunkConcurrency = host.config.chunkConcurrency ?? 5
  const partSize = mobileSyncDownloadPartSize(fileSize, INCREMENTAL_SYNC_CHUNK_SIZE)
  const totalParts = Math.ceil(fileSize / partSize)
  const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1)
  const cachePrefix = `${getAppCacheDirectory()}s3_${Date.now()}_`
  const reportPart = createPartProgressReporter(totalParts, fileSize, (done, total) => {
    host.reportTransfer(done, total, progressDestPath)
  })

  const chunkPaths = await limitExecute(partNumbers, chunkConcurrency, async (partNumber) => {
    const start = (partNumber - 1) * partSize
    const end = Math.min(start + partSize, fileSize) - 1
    const chunkPath = `${cachePrefix}part_${partNumber}`
    const rangeHeader = { Range: `bytes=${start}-${end}` }
    const signed = await signS3Request('GET', url, region, accessKey, secretKey, null, rangeHeader)
    const res = await host.fetchWithAbort(url, {
      headers: { ...s3FetchHeaders(signed), ...rangeHeader }
    })
    if (res.status !== 206) {
      throw new Error(`S3 range download requires 206, got ${res.status}`)
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

export async function downloadS3(
  host: IncrementalCloudOpsHost,
  rel: string,
  localDestPath: string,
  progressDestPath: string,
  knownSize?: number
): Promise<void> {
  host.reportActivity('preparing', progressDestPath)
  let fileSize = knownSize != null && knownSize > 0 ? knownSize : await getS3RemoteSize(host, rel)
  host.reportActivity('downloading', progressDestPath)
  host.reportTransfer(0, fileSize, progressDestPath)
  if (fileSize <= 0) {
    await downloadS3Single(host, rel, localDestPath, fileSize, progressDestPath)
    return
  }
  if (fileSize <= MOBILE_SYNC_PROGRESS_CHUNK_THRESHOLD) {
    await downloadS3Single(host, rel, localDestPath, fileSize, progressDestPath)
    return
  }
  try {
    await downloadS3Chunked(host, rel, localDestPath, fileSize, progressDestPath)
  } catch {
    if (knownSize != null && knownSize > 0) {
      fileSize = await getS3RemoteSize(host, rel)
    }
    await downloadS3Single(host, rel, localDestPath, fileSize, progressDestPath)
  }
}
