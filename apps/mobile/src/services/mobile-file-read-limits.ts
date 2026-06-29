/** 移动端外部存储 UTF-8 整文件读入上限（160MB） */
export const MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES = 160 * 1024 * 1024

export function normalizeExternalFileByteSize(size: unknown): number | undefined {
  if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
    return size
  }
  if (typeof size === 'string' && size.trim() !== '') {
    const parsed = Number(size)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return undefined
}

export function exceedsMobileExternalTextReadLimit(size: unknown): boolean {
  const normalized = normalizeExternalFileByteSize(size)
  return normalized != null && normalized > MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES
}

export function isOversizedReadFailure(error: unknown): boolean {
  const parts: string[] = []
  if (error instanceof Error) {
    parts.push(error.message)
    if (typeof error.stack === 'string') parts.push(error.stack)
    const code = (error as Error & { code?: string }).code
    if (code) parts.push(code)
  } else if (typeof error === 'string') {
    parts.push(error)
  } else {
    try {
      parts.push(JSON.stringify(error))
    } catch {
      parts.push(String(error))
    }
  }
  const text = parts.join('\n')
  return (
    text.includes('OutOfMemoryError') ||
    text.includes('EFBIG') ||
    text.includes('too large to read into memory') ||
    text.includes('File too large to read into memory') ||
    /Failed to allocate a \d+ byte allocation/.test(text)
  )
}

/** JS 层 stat 缺失时，仍应在读前拒绝已知超大文件 */
export function shouldBlockMobileExternalTextRead(byteSize: unknown): boolean {
  const normalized = normalizeExternalFileByteSize(byteSize)
  return normalized != null && normalized > MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES
}

export function formatOversizedFileError(filePath: string, size: number): Error & { code: string } {
  const err = new Error(
    `File too large to read into memory (${size} bytes, limit ${MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES}): ${filePath}`
  ) as Error & { code: string }
  err.code = 'EFBIG'
  return err
}
