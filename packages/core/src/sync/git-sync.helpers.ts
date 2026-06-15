import type { FileChange, FileDiff } from '@baishou/shared'
import {
  isBinaryDiffPath,
  isTextDiffablePath,
  normalizeGitPath as sharedNormalizeGitPath
} from '@baishou/shared'

export { isBinaryDiffPath, isTextDiffablePath }
export const normalizeGitPath = sharedNormalizeGitPath

export function pathsEqual(a: string, b: string): boolean {
  return sharedNormalizeGitPath(a) === sharedNormalizeGitPath(b)
}

export function getAuthenticatedUrl(url: string, username?: string, token?: string): string {
  const isHttp = url.startsWith('http://')
  const isHttps = url.startsWith('https://')
  if (!isHttp && !isHttps) {
    return url
  }
  if (!username && !token) {
    return url
  }
  const protocolLength = isHttps ? 8 : 7
  const cleanUrl = url.substring(protocolLength)
  const atIndex = cleanUrl.indexOf('@')
  const urlWithoutCredentials = atIndex !== -1 ? cleanUrl.substring(atIndex + 1) : cleanUrl
  const credentials =
    username && token
      ? `${encodeURIComponent(username)}:${encodeURIComponent(token)}`
      : username
        ? encodeURIComponent(username)
        : encodeURIComponent(token!)
  return isHttps
    ? `https://${credentials}@${urlWithoutCredentials}`
    : `http://${credentials}@${urlWithoutCredentials}`
}

export function mapStatusToType(status: string): FileChange['status'] {
  switch (status) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    default:
      return 'modified'
  }
}

export function mapWorkingStatus(status: string): FileChange['status'] | '' {
  switch (status.trim()) {
    case 'A':
      return 'added'
    case 'M':
      return 'modified'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    default:
      return ''
  }
}

/** 将新文件全文构造成可展示的 diff hunk（用于未跟踪文件等场景） */
export function buildNewFileDiffHunks(content: string): FileDiff['hunks'] {
  if (!content) {
    return [{ oldStart: 0, oldLines: 0, newStart: 0, newLines: 0, content: '' }]
  }

  const hasTrailingNewline = content.endsWith('\n')
  const lines = hasTrailingNewline ? content.slice(0, -1).split('\n') : content.split('\n')
  const lineCount = Math.max(lines.length, 1)
  const body = lines.map((line) => `+${line}`).join('\n')

  return [
    {
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: lineCount,
      content: body
    }
  ]
}

export function isBaishouManagedPath(filePath: string): boolean {
  const normalized = normalizeGitPath(filePath)
  return (
    normalized === '.baishou-s3.json' ||
    normalized.endsWith('/.baishou-s3.json') ||
    normalized === '.baishou-git.json' ||
    normalized.endsWith('/.baishou-git.json') ||
    normalized.startsWith('.baishou/') ||
    normalized.includes('/.baishou/') ||
    normalized.endsWith('/.baishou')
  )
}

export function isVaultLegacyGitPath(filePath: string): boolean {
  const normalized = normalizeGitPath(filePath)
  return (
    normalized.includes('/.git.vault-legacy/') ||
    normalized.endsWith('/.git.vault-legacy') ||
    normalized.startsWith('.git.vault-legacy/')
  )
}

export function isExcludedFromVersionControl(filePath: string): boolean {
  const normalized = normalizeGitPath(filePath)
  if (isBaishouManagedPath(normalized)) {
    return true
  }
  if (isVaultLegacyGitPath(normalized)) {
    return true
  }
  if (
    normalized.startsWith('.versions/') ||
    normalized.includes('/.versions/') ||
    normalized.endsWith('/.versions')
  ) {
    return true
  }
  if (
    normalized === 'snapshots' ||
    normalized.startsWith('snapshots/') ||
    normalized === 'temp' ||
    normalized.startsWith('temp/') ||
    normalized === '.snapshots' ||
    normalized.startsWith('.snapshots/')
  ) {
    return true
  }
  const base = normalized.split('/').pop() ?? normalized
  return (
    base.endsWith('.db') ||
    base.endsWith('.db-shm') ||
    base.endsWith('.db-wal') ||
    base.endsWith('.db-journal') ||
    base.endsWith('.probe')
  )
}

export const GITLINK_MODE = '160000'

/**
 * 解码 `git ls-files` 等命令输出的 C 风格引号路径。
 * 例如 `"\346\230\257"` → `是`
 */
export function unquoteGitPath(filePath: string): string {
  const trimmed = filePath.trim()
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"') || trimmed.length < 2) {
    return trimmed
  }

  const inner = trimmed.slice(1, -1)
  const bytes: number[] = []

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!
    if (ch !== '\\' || i + 1 >= inner.length) {
      bytes.push(ch.charCodeAt(0) & 0xff)
      continue
    }

    const next = inner[i + 1]!
    if (next >= '0' && next <= '7') {
      const octal = inner.slice(i + 1, i + 4)
      if (/^[0-7]{3}$/.test(octal)) {
        bytes.push(parseInt(octal, 8))
        // 仅跳过 3 位八进制；for 循环末尾的 i++ 会越过前导反斜杠
        i += octal.length
        continue
      }
    }

    switch (next) {
      case 'n':
        bytes.push(0x0a)
        break
      case 't':
        bytes.push(0x09)
        break
      case 'r':
        bytes.push(0x0d)
        break
      case '\\':
        bytes.push(0x5c)
        break
      case '"':
        bytes.push(0x22)
        break
      default:
        bytes.push(next.charCodeAt(0) & 0xff)
        break
    }
    i++
  }

  return new TextDecoder().decode(new Uint8Array(bytes))
}

/** 从 `git ls-files -s` 行解析 gitlink（子模块指针）路径 */
export function parseGitlinkPathFromLsFilesLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const match = /^160000 \S+ \d+\t(.+)$/.exec(trimmed)
  if (!match?.[1]) return null
  return unquoteGitPath(match[1])
}

export function parseDiffHunks(diff: string): FileDiff['hunks'] {
  const hunks: FileDiff['hunks'] = []
  const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)$/gm
  let match: RegExpExecArray | null
  let lastIndex = 0

  while ((match = hunkRegex.exec(diff)) !== null) {
    if (hunks.length > 0) {
      hunks[hunks.length - 1]!.content = diff.substring(lastIndex, match.index)
    }

    hunks.push({
      oldStart: parseInt(match[1]!, 10),
      oldLines: match[2] ? parseInt(match[2], 10) : 1,
      newStart: parseInt(match[3]!, 10),
      newLines: match[4] ? parseInt(match[4], 10) : 1,
      content: ''
    })

    lastIndex = match.index + match[0].length
  }

  if (hunks.length > 0) {
    hunks[hunks.length - 1]!.content = diff.substring(lastIndex)
  }

  const body = diff.trim()
  if (hunks.length === 0 && body) {
    return [{ oldStart: 0, oldLines: 0, newStart: 0, newLines: 0, content: body }]
  }

  return hunks
}
