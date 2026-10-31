/**
 * React Native：通过 registerLocalFileReader 注入 IFileSystem 读盘能力。
 * 发送模型时由 attachment-content.builder / normalizeImageForModel 按需读 base64。
 */
import { extractPromptDocumentText } from '@baishou/shared'
import { getLocalFileReader } from './local-file-reader.registry'

function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '')
  if (!clean) return new Uint8Array(0)
  if (typeof atob === 'function') {
    const binary = atob(clean)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i)
    }
    return out
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const out: number[] = []
  let buffer = 0
  let bits = 0
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!
    if (ch === '=') break
    const val = chars.indexOf(ch)
    if (val < 0) continue
    buffer = (buffer << 6) | val
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((buffer >>> bits) & 0xff)
    }
  }
  return new Uint8Array(out)
}

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

export async function readLocalTextFile(filePath: string, maxBytes?: number): Promise<string> {
  const b64 = await readLocalFileAsBase64Async(filePath)
  if (!b64) return ''
  const bytes = decodeBase64ToBytes(b64)
  const sliced = maxBytes && maxBytes > 0 ? bytes.subarray(0, maxBytes) : bytes
  return new TextDecoder('utf-8').decode(sliced)
}

export async function readPdfTextFromPath(_filePath: string): Promise<string> {
  return ''
}

export async function readLocalDocumentText(
  filePath: string,
  fileName?: string,
  mimeType?: string
): Promise<string> {
  const b64 = await readLocalFileAsBase64Async(filePath)
  if (!b64) return ''
  const bytes = decodeBase64ToBytes(b64)
  return extractPromptDocumentText(fileName || filePath, bytes, mimeType)
}
