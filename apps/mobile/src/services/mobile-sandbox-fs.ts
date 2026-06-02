/**
 * 仅用于应用沙盒 / cache / content:// 等 Expo 可写路径。
 * 业务数据（BaiShou_Root）不得直接 import 本模块。
 */
import { Directory, File, Paths } from 'expo-file-system'

export const documentDirectory = Paths.document.uri
export const cacheDirectory = Paths.cache.uri

/** 与 legacy EncodingType 兼容，供 MobileFileSystem 使用 */
export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64'
} as const

export interface SandboxFileInfo {
  exists: boolean
  isDirectory: boolean
  size?: number
  modificationTime?: number
}

function toDirectory(uri: string): Directory {
  return new Directory(uri)
}

function toFile(uri: string): File {
  return new File(uri)
}

export async function getInfoAsync(uri: string): Promise<SandboxFileInfo> {
  const directory = toDirectory(uri)
  if (directory.exists) {
    const info = directory.info()
    return {
      exists: true,
      isDirectory: true,
      size: info.size ?? undefined,
      modificationTime: info.modificationTime ?? undefined
    }
  }

  const file = toFile(uri)
  if (file.exists) {
    const info = file.info()
    return {
      exists: true,
      isDirectory: false,
      size: info.size ?? undefined,
      modificationTime: info.modificationTime ?? undefined
    }
  }

  return { exists: false, isDirectory: false }
}

export async function readAsStringAsync(
  uri: string,
  options?: { encoding?: (typeof EncodingType)['Base64'] | 'base64' }
): Promise<string> {
  const file = toFile(uri)
  if (options?.encoding === EncodingType.Base64 || options?.encoding === 'base64') {
    return file.base64()
  }
  return file.text()
}

export async function writeAsStringAsync(
  uri: string,
  contents: string,
  options?: { encoding?: (typeof EncodingType)['Base64'] | 'base64' }
): Promise<void> {
  const file = toFile(uri)
  file.write(contents, {
    encoding:
      options?.encoding === EncodingType.Base64 || options?.encoding === 'base64'
        ? 'base64'
        : 'utf8'
  })
}

export async function makeDirectoryAsync(
  uri: string,
  options?: { intermediates?: boolean }
): Promise<void> {
  toDirectory(uri).create({
    intermediates: options?.intermediates ?? false,
    idempotent: true
  })
}

export async function readDirectoryAsync(uri: string): Promise<string[]> {
  return toDirectory(uri)
    .list()
    .map((entry) => entry.name)
}

export async function copyAsync(options: { from: string; to: string }): Promise<void> {
  const fromDirectory = toDirectory(options.from)
  if (fromDirectory.exists) {
    fromDirectory.copy(toDirectory(options.to))
    return
  }
  toFile(options.from).copy(toFile(options.to))
}

export async function moveAsync(options: { from: string; to: string }): Promise<void> {
  const fromDirectory = toDirectory(options.from)
  if (fromDirectory.exists) {
    fromDirectory.move(toDirectory(options.to))
    return
  }
  toFile(options.from).move(toFile(options.to))
}

export async function deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void> {
  const directory = toDirectory(uri)
  if (directory.exists) {
    try {
      directory.delete()
    } catch (error) {
      if (!options?.idempotent) throw error
    }
    return
  }

  const file = toFile(uri)
  if (file.exists) {
    try {
      file.delete()
    } catch (error) {
      if (!options?.idempotent) throw error
    }
    return
  }

  if (!options?.idempotent) {
    throw new Error(`Path not found: ${uri}`)
  }
}
