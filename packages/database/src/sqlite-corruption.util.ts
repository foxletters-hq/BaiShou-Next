function collectErrorText(error: unknown): string {
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
  return parts.join('\n')
}

/** 区分 SQLite 物理损坏与 JSON 字段解析错误（如 Agent FTS 回填时的 malformed JSON） */
export function isSqliteDatabaseCorruptionError(error: unknown): boolean {
  const text = collectErrorText(error)
  if (!text) return false

  const lower = text.toLowerCase()
  if (lower.includes('malformed json')) return false

  return (
    lower.includes('database disk image is malformed') ||
    lower.includes('sqlite_corrupt') ||
    lower.includes('file is not a database') ||
    (lower.includes('malformed') && lower.includes('disk image'))
  )
}
