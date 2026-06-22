import * as ExpoFS from 'expo-file-system/legacy'
import { Platform } from 'react-native'
import {
  isHttpFileUploadNativeAvailable,
  isReadFileChunkNativeAvailable,
  cancelHttpUploadFile,
  httpUploadFileAsync,
  readFileChunkBase64
} from 'expo-baishou-server'
import {
  isExternalStoragePath,
  normalizeSyncFilePath,
  toFileUri
} from './android-external-fs'
import { syncIoPathKey } from './mobile-sync-path.util'
import { raceWithIncrementalSyncAbort, throwIfIncrementalSyncAborted, isIncrementalSyncAbortedError } from './mobile-incremental-sync-abort.util'

const BASE64_DECODE_CHUNK = 8192

/** Base64 → ArrayBuffer，分块解码减轻主线程压力 */
export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let offset = 0; offset < len; offset += BASE64_DECODE_CHUNK) {
    const end = Math.min(offset + BASE64_DECODE_CHUNK, len)
    for (let i = offset; i < end; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
  }
  return bytes.buffer
}

function nativeChunkPath(filePath: string): string {
  const normalized = normalizeSyncFilePath(filePath)
  return isExternalStoragePath(filePath) ? toFileUri(normalized) : normalized
}

function bindAbortCancel(filePath: string, signal?: AbortSignal): () => void {
  if (!signal) return () => {}
  const path = syncIoPathKey(filePath)
  if (signal.aborted) {
    cancelHttpUploadFile(path)
  }
  const onAbort = () => cancelHttpUploadFile(path)
  signal.addEventListener('abort', onAbort)
  return () => signal.removeEventListener('abort', onAbort)
}

/** 增量同步分片读盘：Android 原生 RandomAccessFile，其它平台 Expo 区间读 */
export async function readSyncFileChunk(
  filePath: string,
  position: number,
  length: number
): Promise<ArrayBuffer> {
  if (length <= 0) return new ArrayBuffer(0)

  if (Platform.OS === 'android' && isReadFileChunkNativeAvailable()) {
    try {
      const b64 = readFileChunkBase64(nativeChunkPath(filePath), position, length)
      return base64ToArrayBuffer(b64)
    } catch {
      // fall through
    }
  }

  const b64 = await ExpoFS.readAsStringAsync(toFileUri(normalizeSyncFilePath(filePath)), {
    encoding: ExpoFS.EncodingType.Base64,
    position,
    length
  })
  return base64ToArrayBuffer(b64)
}

/** 从磁盘路径流式 HTTP 上传（Android 原生 OkHttp），跳过沙盒中转 */
export async function httpUploadSyncFile(
  url: string,
  filePath: string,
  method: string,
  headers: Record<string, string>,
  onProgress?: (writtenBytes: number, totalBytes: number) => void,
  signal?: AbortSignal
): Promise<{ status: number }> {
  if (Platform.OS !== 'android' || !isHttpFileUploadNativeAvailable()) {
    throw new Error('Native HTTP file upload is not available')
  }
  const path = syncIoPathKey(filePath)
  const unbindAbort = bindAbortCancel(path, signal)
  try {
    throwIfIncrementalSyncAborted(signal)
    return await raceWithIncrementalSyncAbort(
      signal,
      httpUploadFileAsync(url, path, method, headers, onProgress)
    )
  } catch (error) {
    if (signal?.aborted || isIncrementalSyncAbortedError(error)) {
      cancelHttpUploadFile(path)
    }
    throw error
  } finally {
    unbindAbort()
  }
}

export function canHttpUploadSyncFileFromPath(): boolean {
  return Platform.OS === 'android' && isHttpFileUploadNativeAvailable()
}

export function cancelHttpUploadSyncFile(filePath?: string): void {
  cancelHttpUploadFile(filePath ? syncIoPathKey(filePath) : null)
}
