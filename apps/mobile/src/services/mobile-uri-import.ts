import type { IFileSystem } from '@baishou/core-mobile'
import { EncodingType, readAsStringAsync } from './mobile-sandbox-fs'
import { stripFileScheme } from './android-external-fs'

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

/** 从相册 / DocumentPicker / content:// 等 URI 读取为 base64 */
async function readUriAsBase64(fromUri: string): Promise<string> {
  const candidates = [fromUri]
  if (!fromUri.startsWith('file://') && fromUri.startsWith('/')) {
    candidates.push(`file://${fromUri}`)
  }

  for (const uri of candidates) {
    try {
      return await readAsStringAsync(uri, { encoding: EncodingType.Base64 })
    } catch {
      // try next
    }
  }

  const response = await fetch(fromUri)
  if (!response.ok) {
    throw new Error(`Failed to read URI: ${fromUri}`)
  }
  return arrayBufferToBase64(await response.arrayBuffer())
}

/**
 * 从相册 / DocumentPicker / content:// URI 导入到 vault 绝对路径。
 */
export async function importUriToPath(
  fromUri: string,
  destPath: string,
  fileSystem: IFileSystem
): Promise<void> {
  if (needsStreamImport(fromUri)) {
    const b64 = await readUriAsBase64(fromUri)
    await fileSystem.writeFile(destPath, b64, 'base64')
    return
  }

  const fromPath = stripFileScheme(fromUri)

  try {
    await fileSystem.copyFile(fromPath, destPath)
    return
  } catch {
    // 跨沙盒 / 外部存储或带 authority 的 URI 无法直接 copy，回退 base64 读写
  }

  const b64 = await readUriAsBase64(fromUri.startsWith('file://') ? fromUri : `file://${fromPath}`)
  await fileSystem.writeFile(destPath, b64, 'base64')
}

export function inferImageExtension(uri: string): string {
  const last = uri.split('?')[0].split('/').pop() ?? ''
  const match = last.match(/\.(jpe?g|png|gif|webp)$/i)
  if (!match) return 'jpg'
  const ext = match[1].toLowerCase()
  return ext === 'jpeg' ? 'jpg' : ext
}
