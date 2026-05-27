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

export function isExcludedFromVersionControl(filePath: string): boolean {
  return (
    filePath.startsWith('.baishou/') ||
    filePath.startsWith('.versions/') ||
    filePath.endsWith('.db') ||
    filePath.endsWith('.db-shm') ||
    filePath.endsWith('.db-wal') ||
    filePath.endsWith('.db-journal') ||
    filePath.endsWith('.probe')
  )
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

  return hunks
}
