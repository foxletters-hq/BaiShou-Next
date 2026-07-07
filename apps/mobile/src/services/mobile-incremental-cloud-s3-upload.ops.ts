import {
  buildS3ObjectUrl,
  buildS3ObjectUrlWithQuery,
  INCREMENTAL_SYNC_CHUNK_SIZE,
  limitExecute,
  s3FetchHeaders,
  signS3Request
} from '@baishou/shared'
import { toFileUri } from './android-external-fs'
import { FileSystemUploadType, uploadAsync } from './mobile-http-transfer'
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
import type { IncrementalCloudOpsHost } from './mobile-incremental-cloud-ops.types'

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

async function tryNativeS3Upload(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string,
  fileSize: number
): Promise<boolean> {
  if (!canHttpUploadSyncFileFromPath() || fileSize <= 0) return false
  if (host.isSyncManifestRel(rel)) return false
  try {
    host.reportActivity('uploading', localFilePath)
    const url = buildS3ObjectUrl(host.s3UrlOptions(rel))
    const contentType = 'application/octet-stream'
    const signed = await signS3Request(
      'PUT',
      url,
      host.config.region || 'us-east-1',
      host.config.accessKey || '',
      host.config.secretKey || '',
      null,
      { 'Content-Type': contentType }
    )
    const headers = { ...s3FetchHeaders(signed), 'Content-Type': contentType }
    const response = await httpUploadSyncFile(
      url,
      localFilePath,
      'PUT',
      headers,
      (written, total) => {
        host.reportTransfer(written, total > 0 ? total : fileSize, localFilePath)
      },
      host.abortSignal
    )
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`S3 upload failed: ${response.status}`)
    }
    host.reportTransfer(fileSize, fileSize, localFilePath)
    return true
  } catch (error) {
    rethrowUnlessTransientNativeUploadError(error, host.abortSignal)
    return false
  }
}

async function uploadS3SingleWithUploadAsync(
  host: IncrementalCloudOpsHost,
  rel: string,
  uploadUri: string,
  fileSize: number,
  localFilePath: string
) {
  const url = buildS3ObjectUrl(host.s3UrlOptions(rel))
  const contentType = 'application/octet-stream'
  const signed = await signS3Request(
    'PUT',
    url,
    host.config.region || 'us-east-1',
    host.config.accessKey || '',
    host.config.secretKey || '',
    null,
    { 'Content-Type': contentType }
  )
  const response = await host.transferWithAbort(() =>
    uploadAsync(url, uploadUri, {
      httpMethod: 'PUT',
      headers: { ...s3FetchHeaders(signed), 'Content-Type': contentType },
      uploadType: FileSystemUploadType.BINARY_CONTENT
    })
  )
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`S3 upload failed: ${response.status}`)
  }
  host.reportTransfer(fileSize, fileSize, localFilePath)
}

async function uploadS3SingleWithFetch(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string,
  fileSize: number
) {
  if (fileSize <= 0) {
    throw new Error(`S3 upload skipped empty file: ${rel}`)
  }
  host.reportActivity('reading', localFilePath)
  const body = await readSyncFileChunk(localFilePath, 0, fileSize)
  host.reportActivity('uploading', localFilePath)
  const url = buildS3ObjectUrl(host.s3UrlOptions(rel))
  const contentType = 'application/octet-stream'
  const signed = await signS3Request(
    'PUT',
    url,
    host.config.region || 'us-east-1',
    host.config.accessKey || '',
    host.config.secretKey || '',
    body,
    { 'Content-Type': contentType }
  )
  const response = await host.fetchWithAbort(url, {
    method: 'PUT',
    headers: { ...s3FetchHeaders(signed), 'Content-Type': contentType },
    body
  })
  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status}`)
  }
  host.reportTransfer(fileSize, fileSize, localFilePath)
}

async function uploadS3Single(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string,
  fileSize: number
) {
  if (await tryNativeS3Upload(host, rel, localFilePath, fileSize)) {
    return
  }
  const uploadUri = toFileUri(localFilePath)
  try {
    await uploadS3SingleWithUploadAsync(host, rel, uploadUri, fileSize, localFilePath)
    return
  } catch (error) {
    if (!isTransientNetworkError(error)) throw error
  }
  await uploadS3SingleWithFetch(host, rel, localFilePath, fileSize)
}

function parseS3UploadId(xml: string): string {
  const match = xml.match(/<UploadId>([^<]+)<\/UploadId>/)
  if (!match?.[1]) {
    throw new Error('S3 multipart initiate: missing UploadId')
  }
  return match[1]
}

function buildCompleteMultipartXml(parts: { part: number; etag: string }[]): string {
  const body = parts
    .sort((a, b) => a.part - b.part)
    .map((p) => `<Part><PartNumber>${p.part}</PartNumber><ETag>${p.etag}</ETag></Part>`)
    .join('')
  return `<CompleteMultipartUpload>${body}</CompleteMultipartUpload>`
}

function normalizeEtag(etag: string | null): string {
  if (!etag) throw new Error('S3 uploadPart: missing ETag')
  return etag.startsWith('"') ? etag : `"${etag}"`
}

async function uploadS3Multipart(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string,
  fileSize: number
) {
  const region = host.config.region || 'us-east-1'
  const accessKey = host.config.accessKey || ''
  const secretKey = host.config.secretKey || ''
  const urlOpts = host.s3UrlOptions(rel)
  const contentType = 'application/octet-stream'
  const chunkConcurrency = host.config.chunkConcurrency ?? 5

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
  const initiateRes = await host.fetchWithAbort(initiateUrl, {
    method: 'POST',
    headers: { ...s3FetchHeaders(initiateSigned), 'Content-Type': contentType }
  })
  if (!initiateRes.ok) {
    throw new Error(`S3 multipart initiate failed: ${initiateRes.status}`)
  }
  const uploadId = parseS3UploadId(await initiateRes.text())

  const totalParts = Math.ceil(fileSize / INCREMENTAL_SYNC_CHUNK_SIZE)
  const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1)
  const reportPart = createPartProgressReporter(totalParts, fileSize, (done, total) => {
    host.reportTransfer(done, total, localFilePath)
  })

  try {
    const parts = await limitExecute(partNumbers, chunkConcurrency, async (partNumber) => {
      const start = (partNumber - 1) * INCREMENTAL_SYNC_CHUNK_SIZE
      const chunkSize = Math.min(INCREMENTAL_SYNC_CHUNK_SIZE, fileSize - start)
      host.reportActivity('reading', localFilePath)
      const body = await readSyncFileChunk(localFilePath, start, chunkSize)
      host.reportActivity('uploading', localFilePath)

      const partUrl = buildS3ObjectUrlWithQuery({
        ...urlOpts,
        query: { partNumber: String(partNumber), uploadId }
      })
      const signed = await signS3Request('PUT', partUrl, region, accessKey, secretKey, body)
      const res = await host.fetchWithAbort(partUrl, {
        method: 'PUT',
        headers: s3FetchHeaders(signed),
        body
      })
      if (!res.ok) {
        throw new Error(`S3 uploadPart ${partNumber} failed: ${res.status}`)
      }
      reportPart(partNumber - 1, chunkSize)
      return { part: partNumber, etag: normalizeEtag(res.headers.get('ETag')) }
    })

    const completeXml = buildCompleteMultipartXml(parts)
    const completeBody = new TextEncoder().encode(completeXml)
    const completeUrl = buildS3ObjectUrlWithQuery({
      ...urlOpts,
      query: { uploadId }
    })
    const completePayload = completeBody.buffer.slice(
      completeBody.byteOffset,
      completeBody.byteOffset + completeBody.byteLength
    )
    const completeSigned = await signS3Request(
      'POST',
      completeUrl,
      region,
      accessKey,
      secretKey,
      completePayload,
      { 'Content-Type': 'application/xml' }
    )
    const completeRes = await host.fetchWithAbort(completeUrl, {
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
      const abortSigned = await signS3Request(
        'DELETE',
        abortUrl,
        region,
        accessKey,
        secretKey,
        null
      )
      await host.fetchWithAbort(abortUrl, {
        method: 'DELETE',
        headers: s3FetchHeaders(abortSigned)
      })
    } catch {}
    throw err
  }
}

export async function uploadS3(
  host: IncrementalCloudOpsHost,
  rel: string,
  localFilePath: string
): Promise<void> {
  const stat = await host.fileSystem.stat(localFilePath)
  const fileSize = stat.size ?? 0
  host.reportActivity('uploading', localFilePath)
  host.reportTransfer(0, fileSize, localFilePath)
  if (fileSize <= INCREMENTAL_SYNC_CHUNK_SIZE) {
    await uploadS3Single(host, rel, localFilePath, fileSize)
    return
  }
  if (await tryNativeS3Upload(host, rel, localFilePath, fileSize)) {
    return
  }
  await uploadS3Multipart(host, rel, localFilePath, fileSize)
}
