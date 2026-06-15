import type { FileChange, FileDiff } from '@baishou/shared'

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

function normalizeGitPath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
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

/** 从 `git ls-files -s` 行解析 gitlink（子模块指针）路径 */
export function parseGitlinkPathFromLsFilesLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const match = /^160000 \S+ \d+\t(.+)$/.exec(trimmed)
  return match?.[1] ?? null
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
