import * as FileSystem from 'expo-file-system'
import type { FileStat, IFileSystem } from '@baishou/core-mobile'

function enoentError(filePath: string, syscall: string): Error & { code: string } {
  const err = new Error(`${syscall}: no such file or directory, open '${filePath}'`) as Error & {
    code: string
  }
  err.code = 'ENOENT'
  return err
}

/** Normalize paths from MobileStoragePathService (`file://...` or absolute `/...`). */
function toUri(filePath: string): string {
  if (filePath.startsWith('file://')) return filePath
  if (filePath.startsWith('/')) return `file://${filePath}`
  return filePath
}

/**
 * React Native file I/O via expo-file-system for shared @baishou/core services.
 */
export class ExpoFileSystem implements IFileSystem {
  async exists(filePath: string): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(toUri(filePath))
    return info.exists
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    const uri = toUri(dirPath)
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(uri, {
        intermediates: options?.recursive ?? false
      })
    }
  }

  async readFile(filePath: string, _encoding: 'utf8'): Promise<string> {
    const uri = toUri(filePath)
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists) {
      throw enoentError(filePath, 'open')
    }
    return FileSystem.readAsStringAsync(uri)
  }

  async writeFile(filePath: string, data: string, _encoding: 'utf8'): Promise<void> {
    const uri = toUri(filePath)
    const parent = uri.replace(/\/[^/]+$/, '')
    if (parent && parent !== uri) {
      const parentInfo = await FileSystem.getInfoAsync(parent)
      if (!parentInfo.exists) {
        await FileSystem.makeDirectoryAsync(parent, { intermediates: true })
      }
    }
    await FileSystem.writeAsStringAsync(uri, data)
  }

  async unlink(filePath: string): Promise<void> {
    await FileSystem.deleteAsync(toUri(filePath), { idempotent: true })
  }

  async readdir(dirPath: string): Promise<string[]> {
    const uri = toUri(dirPath)
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists) {
      throw enoentError(dirPath, 'scandir')
    }
    return FileSystem.readDirectoryAsync(uri)
  }

  async stat(filePath: string): Promise<FileStat> {
    const uri = toUri(filePath)
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists) {
      throw enoentError(filePath, 'stat')
    }
    return {
      isFile: !info.isDirectory,
      isDirectory: !!info.isDirectory,
      mtimeMs: info.modificationTime ?? 0
    } as FileStat & { mtimeMs?: number }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await FileSystem.moveAsync({
      from: toUri(oldPath),
      to: toUri(newPath)
    })
  }

  async rm(targetPath: string, _options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    await FileSystem.deleteAsync(toUri(targetPath), { idempotent: true })
  }
}
