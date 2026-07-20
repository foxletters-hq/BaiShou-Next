const INVALID_NAME_PATTERN = /[\\/:*?"<>|]/

export function selectNameRange(
  name: string,
  isDirectory: boolean
): { start: number; end: number } {
  const lastDot = name.lastIndexOf('.')
  if (!isDirectory && lastDot > 0) {
    return { start: 0, end: lastDot }
  }
  return { start: 0, end: name.length }
}

/** VS Code smart 递增：untitled.md → untitled.1.md → untitled.2.md */
export function incrementSmartEntryName(name: string, isFolder: boolean): string {
  const lastDot = !isFolder ? name.lastIndexOf('.') : -1

  if (!isFolder && lastDot >= 0) {
    const suffixRegex = /(.*[.\-_])(\d+)(\..*)$/
    if (suffixRegex.test(name)) {
      return name.replace(suffixRegex, (_match, prefix: string, number: string, ext: string) => {
        const next = parseInt(number, 10) + 1
        return `${prefix}${String(next).padStart(number.length, '0')}${ext}`
      })
    }
    return `${name.slice(0, lastDot)}.1${name.slice(lastDot)}`
  }

  const trailingNumber = /(\d+)$/
  if (trailingNumber.test(name)) {
    return name.replace(trailingNumber, (_match, number: string) => {
      const next = parseInt(number, 10) + 1
      return String(next).padStart(number.length, '0')
    })
  }

  return `${name}1`
}

export function suggestUniqueEntryName(
  existingNames: string[],
  baseName: string,
  isFolder: boolean
): string {
  const existing = new Set(existingNames.map((n) => n.toLowerCase()))
  let candidate = baseName
  while (existing.has(candidate.toLowerCase())) {
    candidate = incrementSmartEntryName(candidate, isFolder)
  }
  return candidate
}

export function validateTreeEntryName(
  name: string,
  existingNames: string[],
  options?: { ignoreName?: string; isDirectory?: boolean }
): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return '请输入文件或文件夹名称'
  }
  if (/^[\\/]/.test(trimmed)) {
    return '名称不能以斜杠开头'
  }
  if (INVALID_NAME_PATTERN.test(trimmed)) {
    return '名称包含无效字符'
  }
  const ignore = options?.ignoreName?.toLowerCase()
  const duplicate = existingNames.some(
    (existing) =>
      existing.toLowerCase() === trimmed.toLowerCase() && existing.toLowerCase() !== ignore
  )
  if (duplicate) {
    return `「${trimmed}」已存在，请使用其他名称`
  }
  return null
}
