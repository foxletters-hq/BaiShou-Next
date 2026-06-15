export function normalizeGitPath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

const BINARY_DIFF_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.ico',
  '.heic',
  '.avif',
  '.svg',
  '.pdf',
  '.woff',
  '.woff2',
  '.mp4',
  '.mp3',
  '.zip',
  '.db'
])

export function isBinaryDiffPath(filePath: string): boolean {
  const normalized = normalizeGitPath(filePath)
  const base = normalized.split('/').pop() ?? normalized
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return false
  return BINARY_DIFF_EXTENSIONS.has(base.slice(dot).toLowerCase())
}

/** 是否适合展示文本 diff（排除图片/二进制、无扩展名目录或 gitlink 等） */
export function isTextDiffablePath(filePath: string): boolean {
  if (isBinaryDiffPath(filePath)) return false
  const normalized = normalizeGitPath(filePath)
  const base = normalized.split('/').pop() ?? normalized
  const dot = base.lastIndexOf('.')
  return dot > 0
}
