import * as fs from 'fs'
import * as path from 'path'
import { randomBytes } from 'crypto'
import { pipeline } from 'stream/promises'
import type { Client } from 'minio'

const RETRYABLE_DOWNLOAD_CODES = new Set([
  'ERR_STREAM_UNABLE_TO_PIPE',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ECONNABORTED',
  'EBUSY',
  'EPERM',
  'EAI_AGAIN'
])

export function isRetryableS3DownloadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as NodeJS.ErrnoException).code
  if (code && RETRYABLE_DOWNLOAD_CODES.has(code)) return true
  const message = error.message
  return (
    message.includes('socket hang up') ||
    message.includes('Connection closed') ||
    message.includes('closed or destroyed stream') ||
    message.includes('Size mismatch')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function removeFileQuietly(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath)
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      // ignore cleanup failures
    }
  }
}

/**
 * 使用 getObject + pipeline 下载，避免 MinIO fGetObject 在 Windows 并发场景下
 * 复用 `.etag.part.minio` 临时文件导致的流管道错误。
 */
export async function downloadS3ObjectToFile(
  client: Client,
  bucket: string,
  objectName: string,
  localDestPath: string
): Promise<void> {
  await fs.promises.mkdir(path.dirname(localDestPath), { recursive: true })

  const tmpPath = `${localDestPath}.${process.pid}.${randomBytes(8).toString('hex')}.download.tmp`
  let writeStream: fs.WriteStream | null = null

  try {
    const dataStream = await client.getObject(bucket, objectName)
    writeStream = fs.createWriteStream(tmpPath, { flags: 'wx' })
    await pipeline(dataStream, writeStream)
    writeStream = null

    await removeFileQuietly(localDestPath)
    await fs.promises.rename(tmpPath, localDestPath)
  } catch (error) {
    if (writeStream && !writeStream.destroyed) {
      writeStream.destroy()
    }
    await removeFileQuietly(tmpPath)
    throw error
  }
}

export async function downloadS3ObjectWithRetry(
  client: Client,
  bucket: string,
  objectName: string,
  localDestPath: string,
  maxAttempts = 3
): Promise<void> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await downloadS3ObjectToFile(client, bucket, objectName, localDestPath)
      return
    } catch (error) {
      lastError = error
      if (!isRetryableS3DownloadError(error) || attempt >= maxAttempts) {
        throw error
      }
      await sleep(200 * attempt)
    }
  }

  throw lastError
}
