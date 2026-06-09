/**
 * React Native：通过 registerLocalFileReader 注入 IFileSystem 读盘能力。
 * 发送模型时由 attachment-content.builder / normalizeImageForModel 按需读 base64。
 */
import { getLocalFileReader } from './local-file-reader.registry'

export function canReadLocalPath(filePath: string): boolean {
  const trimmed = filePath?.trim() ?? ''
  if (!trimmed) return false
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false
  return getLocalFileReader() != null
}

export function readLocalFileAsBase64(_filePath: string): string {
  return ''
}

export async function readLocalFileAsBase64Async(filePath: string): Promise<string> {
  const reader = getLocalFileReader()
  if (!reader || !filePath?.trim()) return ''
  try {
    return await reader.readBase64(filePath)
  } catch {
    return ''
  }
}

export async function readPdfTextFromPath(_filePath: string): Promise<string> {
  return ''
}
