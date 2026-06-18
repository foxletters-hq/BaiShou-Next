import type { FileEncoding, FileStat, IFileSystem } from '@baishou/core-mobile'
import { Platform } from 'react-native'
import { isLocalFsNativeAvailable } from 'expo-baishou-server'
import {
  externalCopySafe,
  externalCopyAsyncSafe,
  externalCopyFileAsyncSafe,
  externalDeleteSafe,
  externalGetInfoSafe,
  externalListDirSafe,
  externalMkdirSafe,
  externalMoveSafe,
  externalReadB64Safe,
  externalReadTextSafe,
  externalWriteB64Safe,
  externalWriteTextSafe,
  externalAppendTextSafe,
  localAppendTextSafe,
  isAndroidAppSandboxPath,
  isExternalStoragePath,
  localGetInfoSafe,
  localListDirSafe,
  toFileUri,
  type ExternalPathInfo
} from './android-external-fs'
import * as SandboxFS from './mobile-sandbox-fs'
import { normalizeMtimeToMs } from '../utils/fs-mtime.util'

/** 跨存储边界时允许 base64 回退的最大文件大小（更大文件会 OOM） */
const CROSS_STORAGE_BASE64_MAX_BYTES = 4 * 1024 * 1024

function enoentError(filePath: string, syscall: string): Error & { code: string } {
  const err = new Error(`${syscall}: no such file or directory, open '${filePath}'`) as Error & {
    code: string
  }
  err.code = 'ENOENT'
  return err
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
    size: info.size,
    mtimeMs: info.modificationTime != null ? normalizeMtimeToMs(info.modificationTime) : undefined
  }
}

/**
 * 移动端唯一文件 I/O 实现：BaiShou_Root /storage → 原生 java.io.File；沙盒 → 原生（Android）或 Expo。
 */
export class MobileFileSystem implements IFileSystem {
  async exists(filePath: string): Promise<boolean> {
    if (isExternalStoragePath(filePath)) {
      return externalGetInfoSafe(filePath).exists
    }
    if (shouldUseAndroidNativeLocalFs(filePath)) {
      return localGetInfoSafe(filePath).exists
    }
    const info = await SandboxFS.getInfoAsync(toFileUri(filePath))
    return info.exists
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    if (isExternalStoragePath(dirPath)) {
      externalMkdirSafe(dirPath, options?.recursive ?? true)
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
      const info = externalGetInfoSafe(filePath)
      if (!info.exists || info.isDirectory) {
        throw enoentError(filePath, 'open')
      }
      return encoding === 'base64' ? externalReadB64Safe(filePath) : externalReadTextSafe(filePath)
    }
    const uri = toFileUri(filePath)
    const info = await SandboxFS.getInfoAsync(uri)
    if (!info.exists) {
      throw enoentError(filePath, 'open')
    }
    return SandboxFS.readAsStringAsync(uri, {
      encoding: encoding === 'base64' ? SandboxFS.EncodingType.Base64 : undefined
    })
  }

  async writeFile(filePath: string, data: string, encoding: FileEncoding = 'utf8'): Promise<void> {
    if (isExternalStoragePath(filePath)) {
      const fileUri = toFileUri(filePath)
      const parentUri = fileUri.replace(/\/[^/]+$/, '')
      if (parentUri && parentUri !== fileUri && isExternalStoragePath(parentUri)) {
        const pi = externalGetInfoSafe(parentUri)
        if (!pi.exists) {
          externalMkdirSafe(parentUri, true)
        }
      }
      if (encoding === 'base64') {
        externalWriteB64Safe(filePath, data)
      } else {
        externalWriteTextSafe(filePath, data)
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
      if (isExternalStoragePath(filePath)) {
        if (!(await this.exists(filePath))) {
          await this.writeFile(filePath, data, encoding)
          return
        }
        externalAppendTextSafe(filePath, data)
        return
      }
      if (shouldUseAndroidNativeLocalFs(filePath) || isAndroidAppSandboxPath(filePath)) {
        if (!(await this.exists(filePath))) {
          await this.writeFile(filePath, data, encoding)
          return
        }
        localAppendTextSafe(filePath, data)
        return
      }
    }

    if (isExternalStoragePath(filePath)) {
      if (await this.exists(filePath)) {
        const existing =
          encoding === 'base64' ? externalReadB64Safe(filePath) : externalReadTextSafe(filePath)
        if (encoding === 'base64') {
          externalWriteB64Safe(filePath, existing + data)
        } else {
          externalWriteTextSafe(filePath, existing + data)
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
      const srcInfo = externalGetInfoSafe(src)
      if (srcInfo.isDirectory) {
        await externalCopyAsyncSafe(src, dest)
        return
      }
      externalCopySafe(src, dest)
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
        ? externalGetInfoSafe(src)
        : shouldUseAndroidNativeLocalFs(src)
          ? localGetInfoSafe(src)
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
      externalDeleteSafe(filePath, true)
      return
    }
    await SandboxFS.deleteAsync(toFileUri(filePath), { idempotent: true })
  }

  async readdir(dirPath: string): Promise<string[]> {
    if (isExternalStoragePath(dirPath)) {
      const info = externalGetInfoSafe(dirPath)
      if (!info.exists || !info.isDirectory) {
        throw enoentError(dirPath, 'scandir')
      }
      return externalListDirSafe(dirPath)
    }
    if (shouldUseAndroidNativeLocalFs(dirPath)) {
      const info = localGetInfoSafe(dirPath)
      if (!info.exists || !info.isDirectory) {
        throw enoentError(dirPath, 'scandir')
      }
      return localListDirSafe(dirPath)
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
      return fileStatFromNativeInfo(filePath, externalGetInfoSafe(filePath))
    }
    if (shouldUseAndroidNativeLocalFs(filePath)) {
      return fileStatFromNativeInfo(filePath, localGetInfoSafe(filePath))
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
      externalMoveSafe(oldPath, newPath)
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
      externalDeleteSafe(targetPath, force)
      return
    }
    if (options?.recursive) {
      await this.rmRecursive(targetPath, force)
      return
    }
    await SandboxFS.deleteAsync(toFileUri(targetPath), { idempotent: force })
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
      const childPath = targetPath.endsWith('/') ? `${targetPath}${entry}` : `${targetPath}/${entry}`
      await this.rm(childPath, { recursive: true, force })
    }
    await SandboxFS.deleteAsync(toFileUri(targetPath), { idempotent: force })
  }
}

export function createMobileFileSystem(): IFileSystem {
  return new MobileFileSystem()
}

/** @deprecated 使用 createMobileFileSystem / MobileFileSystem */
export const ExpoFileSystem = MobileFileSystem
