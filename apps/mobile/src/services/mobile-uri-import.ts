import type { IFileSystem } from '@baishou/core-mobile'
import { Platform } from 'react-native'
import { EncodingType, readAsStringAsync } from './mobile-sandbox-fs'
import {
  externalCopyFileAsyncSafe,
  externalReadB64Safe,
  isExternalStoragePath,
  normalizeExternalStoragePath,
  stripFileScheme,
  toFileUri
} from './android-external-fs'

/** file:///absolute/path 无 authority；file://host/path 有 authority，不能直接 copy */
function hasFileUriAuthority(uri: string): boolean {
  return uri.startsWith('file://') && !uri.startsWith('file:///')
}

function needsStreamImport(uri: string): boolean {
  return uri.startsWith('content://') || uri.startsWith('ph://') || hasFileUriAuthority(uri)
}

async function resolveImportFilePath(pathOrUri: string, fileSystem: IFileSystem): Promise<string> {
  const filePath = stripFileScheme(pathOrUri)
  const stat = await fileSystem.stat(filePath).catch(() => null)
  if (!stat?.isDirectory) return filePath

  const entries = await fileSystem.readdir(filePath).catch(() => [])
  const zipFiles: string[] = []
  for (const name of entries) {
    if (!name || name === '.' || name === '..' || !name.toLowerCase().endsWith('.zip')) continue
    const childPath = `${filePath}/${name}`
    const childStat = await fileSystem.stat(childPath).catch(() => null)
    if (childStat?.isFile) zipFiles.push(childPath)
  }

  if (zipFiles.length === 1) return zipFiles[0]!
  if (zipFiles.length > 1) {
    throw new Error('导入路径指向文件夹，且其中包含多个 ZIP 文件，请直接选择要导入的 ZIP 文件')
  }
  throw new Error('导入路径指向文件夹，未找到可导入的 ZIP 文件')
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** 统一相册 / content / 外部存储 file URI，避免 file://storage/... 畸形路径 */
export function normalizeImportSourceUri(uri: string): string {
  if (uri.startsWith('content://') || uri.startsWith('data:') || uri.startsWith('ph://')) return uri
  return toFileUri(uri)
}

/** 从相册 / DocumentPicker / content:// 等 URI 读取为 base64 */
async function readUriAsBase64(fromUri: string): Promise<string> {
  const normalizedUri = normalizeImportSourceUri(fromUri)
  const candidates = Array.from(new Set([fromUri, normalizedUri]))

  for (const uri of candidates) {
    if (!uri.startsWith('content://') && !uri.startsWith('data:')) {
      try {
        return await readAsStringAsync(uri, { encoding: EncodingType.Base64 })
      } catch {
        // try next
      }
    }
  }

  const absPath = normalizeExternalStoragePath(fromUri)
  if (isExternalStoragePath(absPath)) {
    return externalReadB64Safe(absPath)
  }

  if (fromUri.startsWith('content://') || normalizedUri.startsWith('content://')) {
    const response = await fetch(fromUri.startsWith('content://') ? fromUri : normalizedUri)
    if (!response.ok) {
      throw new Error(`Failed to read URI: ${fromUri}`)
    }
    return arrayBufferToBase64(await response.arrayBuffer())
  }

  throw new Error(`Failed to read URI: ${fromUri}`)
}

/**
 * 从相册 / DocumentPicker / content:// URI 导入到 vault 绝对路径。
 */
export async function importUriToPath(
  fromUri: string,
  destPath: string,
  fileSystem: IFileSystem
): Promise<void> {
  const normalizedFrom = normalizeImportSourceUri(fromUri)

  if (needsStreamImport(normalizedFrom)) {
    if (
      Platform.OS === 'android' &&
      (normalizedFrom.startsWith('content://') || normalizedFrom.startsWith('ph://'))
    ) {
      await externalCopyFileAsyncSafe(normalizedFrom, toFileUri(destPath))
      return
    }

    const b64 = await readUriAsBase64(normalizedFrom)
    await fileSystem.writeFile(destPath, b64, 'base64')
    return
  }

  const fromPath = await resolveImportFilePath(normalizedFrom, fileSystem)

  try {
    await fileSystem.copyFile(fromPath, destPath)
    return
  } catch {
    // 跨沙盒 / 外部存储或带 authority 的 URI 无法直接 copy，回退 base64 读写
  }

  const b64 = await readUriAsBase64(toFileUri(fromPath))
  await fileSystem.writeFile(destPath, b64, 'base64')
}

export function inferImageExtension(uri: string): string {
  const last = uri.split('?')[0].split('/').pop() ?? ''
  const match = last.match(/\.(jpe?g|png|gif|webp)$/i)
  if (!match) return 'jpg'
  const ext = match[1].toLowerCase()
  return ext === 'jpeg' ? 'jpg' : ext
}
