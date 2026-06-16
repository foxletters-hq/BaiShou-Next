import type { IFileSystem } from '@baishou/core-mobile'
import { EncodingType, readAsStringAsync } from './mobile-sandbox-fs'
import {
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
  if (uri.startsWith('content://') || uri.startsWith('data:')) return uri
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
    const b64 = await readUriAsBase64(normalizedFrom)
    await fileSystem.writeFile(destPath, b64, 'base64')
    return
  }

  const fromPath = stripFileScheme(normalizedFrom)

  try {
    await fileSystem.copyFile(fromPath, destPath)
    return
  } catch {
    // 跨沙盒 / 外部存储或带 authority 的 URI 无法直接 copy，回退 base64 读写
  }

  const b64 = await readUriAsBase64(normalizedFrom)
  await fileSystem.writeFile(destPath, b64, 'base64')
}

export function inferImageExtension(uri: string): string {
  const last = uri.split('?')[0].split('/').pop() ?? ''
  const match = last.match(/\.(jpe?g|png|gif|webp)$/i)
  if (!match) return 'jpg'
  const ext = match[1].toLowerCase()
  return ext === 'jpeg' ? 'jpg' : ext
}
