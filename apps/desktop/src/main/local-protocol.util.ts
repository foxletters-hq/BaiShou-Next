import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** 将本机绝对路径转成渲染进程可用的 local:// URL。 */
export function toLocalProtocolFileUrl(absolutePath: string): string {
  return pathToFileURL(absolutePath).href.replace(/^file:/i, 'local:')
}

/**
 * 识别 local:///emojis/... 相对资源。
 * 盘符当 host 的 Windows 绝对路径不走这里。
 */
export function localProtocolEmojiRelativePath(requestUrl: string): string | null {
  try {
    const parsed = new URL(requestUrl)
    if (parsed.hostname) return null
    const rel = decodeURIComponent(parsed.pathname || '')
      .replace(/^\/+/, '')
      .replace(/\\/g, '/')
    if (!rel.toLowerCase().startsWith('emojis/')) return null
    const rest = rel.slice('emojis/'.length)
    if (!rest || rest.includes('..')) return null
    return rest
  } catch {
    return null
  }
}

/**
 * 把 local:// 请求还原成物理路径。
 * Chromium 对标准 scheme 常把 `local:///D:/a.png` 收成 `local://D/a.png`（盘符变 host）。
 */
export function localProtocolUrlToFilePath(requestUrl: string): string {
  const parsed = new URL(requestUrl)
  parsed.search = ''
  parsed.hash = ''
  const host = parsed.hostname || ''
  if (/^[a-zA-Z]$/.test(host)) {
    const pathname = decodeURIComponent(parsed.pathname || '')
    return path.normalize(`${host}:${pathname}`)
  }
  let targetUrl = parsed.href.replace(/^local:/i, 'file:')
  if (targetUrl.startsWith('file://') && !targetUrl.startsWith('file:///')) {
    targetUrl = `file:///${targetUrl.slice('file://'.length)}`
  }
  return fileURLToPath(targetUrl)
}

export type LocalProtocolByteRange = { start: number; end: number }

/**
 * 解析 Range: bytes=start-end / bytes=-suffix。
 * 无法识别或越界时返回 unsatisfiable，由调用方回 416。
 */
export function parseByteRangeHeader(
  header: string | null | undefined,
  size: number
): LocalProtocolByteRange | 'unsatisfiable' | null {
  if (size <= 0) return null
  const raw = header?.trim()
  if (!raw) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(raw)
  if (!match) return 'unsatisfiable'
  const startTok = match[1] ?? ''
  const endTok = match[2] ?? ''
  if (!startTok && !endTok) return 'unsatisfiable'
  if (!startTok) {
    const suffix = Number(endTok)
    if (!Number.isInteger(suffix) || suffix <= 0) return 'unsatisfiable'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(startTok)
  if (!Number.isInteger(start) || start < 0 || start >= size) return 'unsatisfiable'
  const end = endTok === '' ? size - 1 : Number(endTok)
  if (!Number.isInteger(end) || end < start) return 'unsatisfiable'
  return { start, end: Math.min(end, size - 1) }
}

export function localProtocolFileResponseHeaders(input: {
  contentType: string
  size: number
  range?: LocalProtocolByteRange | null
}): { status: number; headers: Record<string, string> } {
  const headers: Record<string, string> = {
    'Content-Type': input.contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache'
  }
  if (!input.range) {
    return { status: 200, headers: { ...headers, 'Content-Length': String(input.size) } }
  }
  return {
    status: 206,
    headers: {
      ...headers,
      'Content-Length': String(input.range.end - input.range.start + 1),
      'Content-Range': `bytes ${input.range.start}-${input.range.end}/${input.size}`
    }
  }
}

export function localFileContentType(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'svg':
      return 'image/svg+xml'
    case 'pdf':
      return 'application/pdf'
    case 'md':
    case 'txt':
      return 'text/plain; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}
