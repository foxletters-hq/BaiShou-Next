import type { FileEncoding, FileStat, IFileSystem } from '@baishou/core-mobile'
import { Platform } from 'react-native'
import { isLocalFsNativeAvailable } from 'expo-baishou-server'
import {
  externalCopyAsyncSafe,
  externalCopyFileAsyncSafe,
  externalDeleteAsyncSafe,
  externalGetInfoAsyncSafe,
  externalListDirAsyncSafe,
  externalMkdirAsyncSafe,
  externalMoveAsyncSafe,
  externalReadB64AsyncSafe,
  externalReadTextAsyncSafe,
  externalWriteB64AsyncSafe,
  externalWriteTextAsyncSafe,
  externalAppendTextAsyncSafe,
  localAppendTextAsyncSafe,
  isAndroidAppSandboxPath,
  isExternalStoragePath,
  localGetInfoAsyncSafe,
  localListDirAsyncSafe,
  toFileUri,
  type ExternalPathInfo
} from './android-external-fs'
import * as SandboxFS from './mobile-sandbox-fs'
import { normalizeMtimeToMs } from '../utils/fs-mtime.util'
import {
  formatOversizedFileError,
  normalizeExternalFileByteSize,
  shouldBlockMobileExternalTextRead
} from './mobile-file-read-limits'

/** 跨存储边界时允许 base64 回退的最大文件大小（更大文件会 OOM） */
const CROSS_STORAGE_BASE64_MAX_BYTES = 4 * 1024 * 1024

function enoentError(filePath: string, syscall: string): Error & { code: string } {
  const err = new Error(`${syscall}: no such file or directory, open '${filePath}'`) as Error & {
    code: string
  }
  err.code = 'ENOENT'
  return err
}

function isNativeNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (code === 'ENOENT') return true
  const msg = error instanceof Error ? error.message : String(error)
  return /FileNotFoundException|\bENOENT\b|No such file/i.test(msg)
}

/** Android 沙盒路径用 java.io.File，避免 expo-file-system 对 Unicode 文件名的 stat/readdir 失败 */
function shouldUseAndroidNativeLocalFs(filePath: string): boolean {
  return (
    Platform.OS === 'android' && isAndroidAppSandboxPath(filePath) && isLocalFsNativeAvailable()
  )
}

function fileStatFromNativeInfo(
  filePath: string,
  info: ExternalPathInfo,
  syscall = 'stat'
): FileStat {
  if (!info.exists) {
    throw enoentError(filePath, syscall)
  }
  return {
    isFile: !info.isDirectory,
    isDirectory: info.isDirectory,
    size: normalizeExternalFileByteSize(info.size),
    mtimeMs: info.modificationTime != null ? normalizeMtimeToMs(info.modificationTime) : undefined
  }
}

/**
 * 移动端唯一文件 I/O 实现：BaiShou_Root /storage → 原生 java.io.File；沙盒 → 原生（Android）或 Expo。
 */
export class MobileFileSystem implements IFileSystem {
  async exists(filePath: string): Promise<boolean> {
    if (isExternalStoragePath(filePath)) {
      return (await externalGetInfoAsyncSafe(filePath)).exists
    }
    if (shouldUseAndroidNativeLocalFs(filePath)) {
      return (await localGetInfoAsyncSafe(filePath)).exists
    }
    const info = await SandboxFS.getInfoAsync(toFileUri(filePath))
    return info.exists
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    if (isExternalStoragePath(dirPath)) {
      await externalMkdirAsyncSafe(dirPath, options?.recursive ?? true)
      return
    }
    const uri = toFileUri(dirPath)
    const info = await SandboxFS.getInfoAsync(uri)
    if (!info.exists) {
      await SandboxFS.makeDirectoryAsync(uri, {
        intermediates: options?.recursive ?? true
      })
    }
  }

  async readFile(filePath: string, encoding: FileEncoding = 'utf8'): Promise<string> {
    if (isExternalStoragePath(filePath)) {
      const info = await externalGetInfoAsyncSafe(filePath)
      if (!info.exists || info.isDirectory) {
        throw enoentError(filePath, 'open')
      }
      if (encoding !== 'base64') {
        const byteSize = normalizeExternalFileByteSize(info.size)
        if (shouldBlockMobileExternalTextRead(byteSize)) {
          throw formatOversizedFileError(filePath, byteSize!)
        }
      }
      try {
        return encoding === 'base64'
          ? await externalReadB64AsyncSafe(filePath)
          : await externalReadTextAsyncSafe(filePath)
      } catch (e) {
        if (isNativeNotFoundError(e)) {
          throw enoentError(filePath, 'open')
        }
        throw e
      }
    }
    const uri = toFileUri(filePath)
    const info = await SandboxFS.getInfoAsync(uri)
    if (!info.exists) {
      throw enoentError(filePath, 'open')
    }
    if (encoding !== 'base64') {
      const byteSize = normalizeExternalFileByteSize(info.size)
      if (shouldBlockMobileExternalTextRead(byteSize)) {
        throw formatOversizedFileError(filePath, byteSize!)
      }
    }
    return SandboxFS.readAsStringAsync(uri, {
      encoding: encoding === 'base64' ? SandboxFS.EncodingType.Base64 : undefined
    })
  }

  async writeFile(filePath: string, data: string, encoding: FileEncoding = 'utf8'): Promise<void> {
    if (isExternalStoragePath(filePath)) {
      // 原生 ExternalStorageFiles.writeString/writeBase64 内部已调用 parentFile.mkdirs()，
      // 跳过冗余父目录 stat 可减少一次慢速外部存储 FUSE 往返。
      if (encoding === 'base64') {
        await externalWriteB64AsyncSafe(filePath, data)
      } else {
        await externalWriteTextAsyncSafe(filePath, data)
      }
      return
    }
    const uri = toFileUri(filePath)
    const parent = uri.replace(/\/[^/]+$/, '')
    if (parent && parent !== uri) {
      const parentInfo = await SandboxFS.getInfoAsync(parent)
      if (!parentInfo.exists) {
        await SandboxFS.makeDirectoryAsync(parent, { intermediates: true })
      }
    }
    await SandboxFS.writeAsStringAsync(uri, data, {
      encoding: encoding === 'base64' ? SandboxFS.EncodingType.Base64 : undefined
    })
  }

  async appendFile(filePath: string, data: string, encoding: FileEncoding = 'utf8'): Promise<void> {
    if (!data) return

    if (encoding === 'utf8' && Platform.OS === 'android' && isLocalFsNativeAvailable()) {
      // 原生 appendString/appendStringAny 内部已执行 parentFile.mkdirs() 与 FileOutputStream(file, true)，
      // 文件不存在时会自动创建；跳过 JS 侧 exists→writeFile 两步分支以消除 TOCTOU 竞态。
      if (isExternalStoragePath(filePath)) {
        await externalAppendTextAsyncSafe(filePath, data)
        return
      }
      if (shouldUseAndroidNativeLocalFs(filePath) || isAndroidAppSandboxPath(filePath)) {
        await localAppendTextAsyncSafe(filePath, data)
        return
      }
    }

    if (isExternalStoragePath(filePath)) {
      if (await this.exists(filePath)) {
        const info = await externalGetInfoAsyncSafe(filePath)
        if (encoding !== 'base64') {
          const byteSize = normalizeExternalFileByteSize(info.size)
          if (shouldBlockMobileExternalTextRead(byteSize)) {
            throw formatOversizedFileError(filePath, byteSize!)
          }
        }
        const existing =
          encoding === 'base64'
            ? await externalReadB64AsyncSafe(filePath)
            : await externalReadTextAsyncSafe(filePath)
        if (encoding === 'base64') {
          await externalWriteB64AsyncSafe(filePath, existing + data)
        } else {
          await externalWriteTextAsyncSafe(filePath, existing + data)
        }
      } else {
        await this.writeFile(filePath, data, encoding)
      }
      return
    }
    const uri = toFileUri(filePath)
    if (await this.exists(filePath)) {
      const existing = await SandboxFS.readAsStringAsync(uri, {
        encoding: encoding === 'base64' ? SandboxFS.EncodingType.Base64 : undefined
      })
      await SandboxFS.writeAsStringAsync(uri, existing + data, {
        encoding: encoding === 'base64' ? SandboxFS.EncodingType.Base64 : undefined
      })
      return
    }
    await this.writeFile(filePath, data, encoding)
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const srcExternal = isExternalStoragePath(src)
    const destExternal = isExternalStoragePath(dest)

    if (srcExternal && destExternal) {
      await externalCopyAsyncSafe(src, dest)
      return
    }

    if (!srcExternal && !destExternal) {
      if (shouldUseAndroidNativeLocalFs(src)) {
        await externalCopyFileAsyncSafe(src, dest)
        return
      }

      const srcUri = toFileUri(src)
      const destUri = toFileUri(dest)
      const srcInfo = await SandboxFS.getInfoAsync(srcUri)
      if (srcInfo.isDirectory) {
        const destInfo = await SandboxFS.getInfoAsync(destUri)
        if (destInfo.exists) {
          await SandboxFS.deleteAsync(destUri, { idempotent: true })
        }
        await SandboxFS.copyAsync({ from: srcUri, to: destUri })
        return
      }
      const destInfo = await SandboxFS.getInfoAsync(destUri)
      if (destInfo.exists) {
        await SandboxFS.deleteAsync(destUri, { idempotent: true })
      }
      await SandboxFS.copyAsync({ from: srcUri, to: destUri })
      return
    }

    // 外部 ↔ 沙盒：优先原生流式复制；仅小文件可在失败时回退 base64
    try {
      await externalCopyFileAsyncSafe(src, dest)
    } catch (error) {
      const srcInfo = isExternalStoragePath(src)
        ? await externalGetInfoAsyncSafe(src)
        : shouldUseAndroidNativeLocalFs(src)
          ? await localGetInfoAsyncSafe(src)
          : await SandboxFS.getInfoAsync(toFileUri(src))
      if (srcInfo.isDirectory) {
        throw new Error(`Cannot copy directory across storage boundaries: ${src}`)
      }
      const size = srcInfo.size ?? 0
      if (size > CROSS_STORAGE_BASE64_MAX_BYTES) {
        throw error
      }
      const data = await this.readFile(src, 'base64')
      await this.writeFile(dest, data, 'base64')
    }
  }

  async unlink(filePath: string): Promise<void> {
    if (isExternalStoragePath(filePath)) {
      await externalDeleteAsyncSafe(filePath, true)
      return
    }
    await SandboxFS.deleteAsync(toFileUri(filePath), { idempotent: true })
  }

  async readdir(dirPath: string): Promise<string[]> {
    if (isExternalStoragePath(dirPath)) {
      const info = await externalGetInfoAsyncSafe(dirPath)
      if (!info.exists || !info.isDirectory) {
        throw enoentError(dirPath, 'scandir')
      }
      try {
        return await externalListDirAsyncSafe(dirPath)
      } catch (e) {
        if (isNativeNotFoundError(e)) {
          throw enoentError(dirPath, 'scandir')
        }
        throw e
      }
    }
    if (shouldUseAndroidNativeLocalFs(dirPath)) {
      const info = await localGetInfoAsyncSafe(dirPath)
      if (!info.exists || !info.isDirectory) {
        throw enoentError(dirPath, 'scandir')
      }
      try {
        return await localListDirAsyncSafe(dirPath)
      } catch (e) {
        if (isNativeNotFoundError(e)) {
          throw enoentError(dirPath, 'scandir')
        }
        throw e
      }
    }
    const uri = toFileUri(dirPath)
    const info = await SandboxFS.getInfoAsync(uri)
    if (!info.exists) {
      throw enoentError(dirPath, 'scandir')
    }
    return SandboxFS.readDirectoryAsync(uri)
  }

  async stat(filePath: string): Promise<FileStat> {
    if (isExternalStoragePath(filePath)) {
      return fileStatFromNativeInfo(filePath, await externalGetInfoAsyncSafe(filePath))
    }
    if (shouldUseAndroidNativeLocalFs(filePath)) {
      return fileStatFromNativeInfo(filePath, await localGetInfoAsyncSafe(filePath))
    }
    const uri = toFileUri(filePath)
    const info = await SandboxFS.getInfoAsync(uri)
    if (!info.exists) {
      throw enoentError(filePath, 'stat')
    }
    return {
      isFile: !info.isDirectory,
      isDirectory: !!info.isDirectory,
      size: 'size' in info && typeof info.size === 'number' ? info.size : undefined,
      mtimeMs: info.modificationTime != null ? normalizeMtimeToMs(info.modificationTime) : undefined
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (isExternalStoragePath(oldPath) && isExternalStoragePath(newPath)) {
      await externalMoveAsyncSafe(oldPath, newPath)
      return
    }
    await SandboxFS.moveAsync({
      from: toFileUri(oldPath),
      to: toFileUri(newPath)
    })
  }

  async rm(targetPath: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    const force = options?.force ?? true
    if (isExternalStoragePath(targetPath)) {
      await externalDeleteAsyncSafe(targetPath, force)
      return
    }
    try {
      await SandboxFS.deleteAsync(toFileUri(targetPath), { idempotent: force })
      if (!(await this.exists(targetPath))) {
        return
      }
    } catch (e) {
      if (!options?.recursive) {
        throw e
      }
    }
    if (options?.recursive) {
      await this.rmRecursive(targetPath, force)
    }
  }

  private async rmRecursive(targetPath: string, force: boolean): Promise<void> {
    if (!(await this.exists(targetPath))) {
      if (!force) {
        throw enoentError(targetPath, 'rm')
      }
      return
    }

    const stat = await this.stat(targetPath)
    if (!stat.isDirectory) {
      await this.unlink(targetPath)
      return
    }

    const entries = await this.readdir(targetPath)
    for (const entry of entries) {
      const childPath = targetPath.endsWith('/')
        ? `${targetPath}${entry}`
        : `${targetPath}/${entry}`
      await this.rm(childPath, { recursive: true, force })
    }
    await SandboxFS.deleteAsync(toFileUri(targetPath), { idempotent: force })
  }

  async md5Hex(filePath: string): Promise<string> {
    const { md5HexForSyncFile } = await import('./mobile-sync-file-md5.util')
    return md5HexForSyncFile(this, filePath)
  }
}

export function createMobileFileSystem(): IFileSystem {
  return new MobileFileSystem()
}

/** @deprecated 使用 createMobileFileSystem / MobileFileSystem */
export const ExpoFileSystem = MobileFileSystem
