import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
import type { IFileSystem } from '@baishou/core-mobile'
import { isLocalFsNativeAvailable } from 'expo-baishou-server'
import {
  externalMd5HexSafe,
  isAndroidAppSandboxPath,
  isExternalStoragePath,
  localMd5HexSafe,
  normalizeSyncFilePath
} from './android-external-fs'

export { normalizeSyncFilePath }

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function shouldUseAndroidNativeLocalMd5(filePath: string): boolean {
  return (
    Platform.OS === 'android' && isAndroidAppSandboxPath(filePath) && isLocalFsNativeAvailable()
  )
}

/** 增量同步用 MD5（hex）；Android 优先原生流式哈希，其它平台回退 JS */
export async function md5HexForSyncFile(
  fileSystem: IFileSystem,
  filePath: string
): Promise<string> {
  if (isExternalStoragePath(filePath)) {
    const nativeHash = externalMd5HexSafe(filePath)
    if (nativeHash) return nativeHash
  } else if (shouldUseAndroidNativeLocalMd5(filePath)) {
    const nativeHash = localMd5HexSafe(filePath)
    if (nativeHash) return nativeHash
  }

  const b64 = await fileSystem.readFile(filePath, 'base64')
  const bytes = base64ToBytes(b64)
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.MD5, bytes)
  return bytesToHex(new Uint8Array(digest))
}
