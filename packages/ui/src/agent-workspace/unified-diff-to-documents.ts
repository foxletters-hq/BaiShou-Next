export interface UnifiedDiffHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  /** Raw hunk body lines including leading space / + / - */
  lines: string[]
}

export interface ParsedUnifiedDiff {
  path: string | null
  hunks: UnifiedDiffHunk[]
  truncated: boolean
}

export interface UnifiedDiffDocuments {
  original: string
  modified: string
}

export type ResolveFileChangeDocumentsResult =
  | { mode: 'merge'; original: string; modified: string; truncated: boolean }
  | { mode: 'fallback'; truncated: boolean; reason: 'empty' | 'truncated' | 'parse_failed' | 'reverse_failed' }

const TRUNCATION_MARKERS = ['… (diff truncated)', '...(diff truncated)', '(diff truncated)']

export function isUnifiedDiffTruncated(diff: string): boolean {
  return TRUNCATION_MARKERS.some((marker) => diff.includes(marker))
}

function splitContentLines(content: string): string[] {
  if (content.length === 0) return []
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

function joinContentLines(lines: string[]): string {
  if (lines.length === 0) return ''
  return `${lines.join('\n')}\n`
}

function parseHunkHeader(line: string): Omit<UnifiedDiffHunk, 'lines'> | null {
  const match = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line)
  if (!match) return null
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] != null ? Number(match[2]) : 1,
    newStart: Number(match[3]),
    newCount: match[4] != null ? Number(match[4]) : 1
  }
}

/**
 * Parse a unified diff string into hunks.
 * Returns null when the input has no usable hunk content.
 */
export function parseUnifiedDiff(diff: string): ParsedUnifiedDiff | null {
  const trimmed = diff.trim()
  if (!trimmed) return null

  const truncated = isUnifiedDiffTruncated(diff)
  const lines = diff.replace(/\r\n/g, '\n').split('\n')
  let path: string | null = null
  const hunks: UnifiedDiffHunk[] = []
  let current: UnifiedDiffHunk | null = null

  for (const line of lines) {
    if (TRUNCATION_MARKERS.some((marker) => line.includes(marker))) {
      continue
    }
    if (line.startsWith('+++ ')) {
      const raw = line.slice(4).trim()
      path = raw.replace(/^[ab]\//, '') || path
      continue
    }
    if (line.startsWith('--- ')) {
      if (!path) {
        const raw = line.slice(4).trim()
        path = raw.replace(/^[ab]\//, '') || path
      }
      continue
    }
    if (line.startsWith('@@')) {
      const header = parseHunkHeader(line)
      if (!header) continue
      current = { ...header, lines: [] }
      hunks.push(current)
      continue
    }
    if (!current) continue
    // Only real unified prefixes; ignore trailing blank lines after the last hunk line.
    if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
      current.lines.push(line)
    }
  }

  if (hunks.length === 0) return null
  return { path, hunks, truncated }
}

function hunkSideLines(hunk: UnifiedDiffHunk, side: 'old' | 'new'): string[] {
  const out: string[] = []
  for (const line of hunk.lines) {
    const prefix = line.charAt(0)
    const text = line.slice(1)
    if (side === 'old') {
      if (prefix === ' ' || prefix === '-') out.push(text)
    } else if (prefix === ' ' || prefix === '+') {
      out.push(text)
    }
  }
  return out
}

/** Build documents solely from hunk bodies (correct for create/delete / full-file diffs). */
export function documentsFromHunks(hunks: UnifiedDiffHunk[]): UnifiedDiffDocuments {
  const originalLines: string[] = []
  const modifiedLines: string[] = []
  for (const hunk of hunks) {
    originalLines.push(...hunkSideLines(hunk, 'old'))
    modifiedLines.push(...hunkSideLines(hunk, 'new'))
  }
  return {
    original: joinContentLines(originalLines),
    modified: joinContentLines(modifiedLines)
  }
}

/**
 * Reverse-apply unified hunks onto a full modified document to recover the original.
 * Hunks are applied from bottom to top so line indices stay valid.
 */
export function reverseApplyHunksToModified(
  modified: string,
  hunks: UnifiedDiffHunk[]
): { original: string; ok: boolean } {
  const lines = splitContentLines(modified)

  for (let i = hunks.length - 1; i >= 0; i--) {
    const hunk = hunks[i]!
    const oldLines = hunkSideLines(hunk, 'old')
    const newLines = hunkSideLines(hunk, 'new')

    if (hunk.newCount === 0 && newLines.length === 0) {
      // Pure deletion in the forward diff: insert old lines at newStart.
      const insertAt = Math.max(0, Math.min(lines.length, hunk.newStart > 0 ? hunk.newStart - 1 : 0))
      lines.splice(insertAt, 0, ...oldLines)
      continue
    }

    const start = hunk.newStart > 0 ? hunk.newStart - 1 : 0
    if (start < 0 || start + newLines.length > lines.length) {
      return { original: '', ok: false }
    }

    for (let j = 0; j < newLines.length; j++) {
      if (lines[start + j] !== newLines[j]) {
        return { original: '', ok: false }
      }
    }

    lines.splice(start, newLines.length, ...oldLines)
  }

  return { original: joinContentLines(lines), ok: true }
}

export function unifiedDiffToDocuments(diff: string): (UnifiedDiffDocuments & { truncated: boolean }) | null {
  const parsed = parseUnifiedDiff(diff)
  if (!parsed) return null
  return { ...documentsFromHunks(parsed.hunks), truncated: parsed.truncated }
}

/**
 * Resolve original/modified for the merge viewer.
 * Prefers disk content as modified when available; reverses hunks to recover original.
 */
export function resolveFileChangeDocuments(options: {
  diff?: string | null
  /** Current on-disk content; `null` means file is missing (e.g. deleted). */
  diskContent?: string | null
  diskAvailable?: boolean
}): ResolveFileChangeDocumentsResult {
  const diff = options.diff?.trim() ?? ''
  if (!diff) {
    return { mode: 'fallback', truncated: false, reason: 'empty' }
  }

  const parsed = parseUnifiedDiff(diff)
  if (!parsed) {
    return { mode: 'fallback', truncated: isUnifiedDiffTruncated(diff), reason: 'parse_failed' }
  }

  if (parsed.truncated) {
    return { mode: 'fallback', truncated: true, reason: 'truncated' }
  }

  const fromHunks = documentsFromHunks(parsed.hunks)

  if (options.diskAvailable) {
    const modified = options.diskContent ?? ''
    const reversed = reverseApplyHunksToModified(modified, parsed.hunks)
    if (reversed.ok) {
      return {
        mode: 'merge',
        original: reversed.original,
        modified,
        truncated: false
      }
    }
    // Disk no longer matches the recorded diff — fall back to hunk reconstruction.
    return {
      mode: 'merge',
      original: fromHunks.original,
      modified: fromHunks.modified,
      truncated: false
    }
  }

  return {
    mode: 'merge',
    original: fromHunks.original,
    modified: fromHunks.modified,
    truncated: false
  }
}
