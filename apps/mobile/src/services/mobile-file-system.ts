import type { FileEncoding, FileStat, IFileSystem } from '@baishou/core-mobile'
import {
  externalCopySafe,
  externalDeleteSafe,
  externalGetInfoSafe,
  externalListDirSafe,
  externalMkdirSafe,
  externalMoveSafe,
  externalReadB64Safe,
  externalReadTextSafe,
  externalWriteB64Safe,
  externalWriteTextSafe,
  isExternalStoragePath,
  stripFileScheme,
  normalizeExternalStoragePath,
  toFileUri
} from './android-external-fs'
import * as SandboxFS from './mobile-sandbox-fs'

function enoentError(filePath: string, syscall: string): Error & { code: string } {
  const err = new Error(`${syscall}: no such file or directory, open '${filePath}'`) as Error & {
    code: string
  }
  err.code = 'ENOENT'
  return err
}

function normalizePath(filePath: string): string {
  return normalizeExternalStoragePath(filePath)
}

/**
 * 移动端唯一文件 I/O 实现：BaiShou_Root /storage → 原生 java.io.File；沙盒 → Expo。
 */
export class MobileFileSystem implements IFileSystem {
  async exists(filePath: string): Promise<boolean> {
    if (isExternalStoragePath(filePath)) {
      return externalGetInfoSafe(filePath).exists
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

  async copyFile(src: string, dest: string): Promise<void> {
    if (isExternalStoragePath(src) && isExternalStoragePath(dest)) {
      const srcInfo = externalGetInfoSafe(src)
      if (srcInfo.isDirectory) {
        await this.mkdir(dest, { recursive: true })
        const names = externalListDirSafe(src)
        for (const name of names) {
          await this.copyFile(`${normalizePath(src)}/${name}`, `${normalizePath(dest)}/${name}`)
        }
        return
      }
      externalCopySafe(src, dest)
      return
    }
    await SandboxFS.copyAsync({
      from: toFileUri(src),
      to: toFileUri(dest)
    })
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
    const uri = toFileUri(dirPath)
    const info = await SandboxFS.getInfoAsync(uri)
    if (!info.exists) {
      throw enoentError(dirPath, 'scandir')
    }
    return SandboxFS.readDirectoryAsync(uri)
  }

  async stat(filePath: string): Promise<FileStat> {
    if (isExternalStoragePath(filePath)) {
      const info = externalGetInfoSafe(filePath)
      if (!info.exists) {
        throw enoentError(filePath, 'stat')
      }
      return {
        isFile: !info.isDirectory,
        isDirectory: info.isDirectory,
        size: info.size,
        mtimeMs: info.modificationTime
      }
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
      mtimeMs: info.modificationTime != null ? info.modificationTime * 1000 : undefined
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
    if (isExternalStoragePath(targetPath)) {
      externalDeleteSafe(targetPath, options?.force ?? true)
      return
    }
    await SandboxFS.deleteAsync(toFileUri(targetPath), { idempotent: options?.force ?? true })
  }
}

export function createMobileFileSystem(): IFileSystem {
  return new MobileFileSystem()
}

/** @deprecated 使用 createMobileFileSystem / MobileFileSystem */
export const ExpoFileSystem = MobileFileSystem
