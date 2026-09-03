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

function hunkLineText(line: string): string {
  return line.slice(1).replace(/\r$/, '')
}

function hunkSideLines(hunk: UnifiedDiffHunk, side: 'old' | 'new'): string[] {
  const out: string[] = []
  for (const line of hunk.lines) {
    const prefix = line.charAt(0)
    const text = hunkLineText(line)
    if (side === 'old') {
      if (prefix === ' ' || prefix === '-') out.push(text)
    } else if (prefix === ' ' || prefix === '+') {
      out.push(text)
    }
  }
  return out
}

function linesMatchAt(haystack: string[], start: number, needle: string[]): boolean {
  if (start < 0 || start + needle.length > haystack.length) return false
  for (let i = 0; i < needle.length; i++) {
    if (haystack[start + i] !== needle[i]) return false
  }
  return true
}

function findContiguousLines(haystack: string[], needle: string[], preferredStart: number): number {
  if (needle.length === 0) return -1
  if (linesMatchAt(haystack, preferredStart, needle)) return preferredStart
  let best = -1
  let bestDistance = Number.POSITIVE_INFINITY
  const last = haystack.length - needle.length
  for (let i = 0; i <= last; i++) {
    if (!linesMatchAt(haystack, i, needle)) continue
    const distance = Math.abs(i - preferredStart)
    if (distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  }
  return best
}

/** Place hunk sides at the recorded 1-based start so merge line numbers match the file. */
export function documentsFromHunksAligned(hunks: UnifiedDiffHunk[]): UnifiedDiffDocuments {
  return {
    original: joinContentLines(placeHunkSides(hunks, 'old')),
    modified: joinContentLines(placeHunkSides(hunks, 'new'))
  }
}

function placeHunkSides(hunks: UnifiedDiffHunk[], side: 'old' | 'new'): string[] {
  const lines: string[] = []
  for (const hunk of hunks) {
    const start = side === 'old' ? hunk.oldStart : hunk.newStart
    const sideLines = hunkSideLines(hunk, side)
    if (start <= 0) {
      lines.push(...sideLines)
      continue
    }
    while (lines.length < start - 1) {
      lines.push('')
    }
    if (lines.length === start - 1) {
      lines.push(...sideLines)
      continue
    }
    const at = start - 1
    for (let i = 0; i < sideLines.length; i++) {
      lines[at + i] = sideLines[i]!
    }
    if (lines.length < at + sideLines.length) {
      lines.length = at + sideLines.length
    }
  }
  return lines
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

function reverseApplyHunksAtRecordedStarts(
  lines: string[],
  hunks: UnifiedDiffHunk[]
): boolean {
  for (let i = hunks.length - 1; i >= 0; i--) {
    const hunk = hunks[i]!
    const oldLines = hunkSideLines(hunk, 'old')
    const newLines = hunkSideLines(hunk, 'new')

    if (hunk.newCount === 0 && newLines.length === 0) {
      const insertAt = Math.max(0, Math.min(lines.length, hunk.newStart > 0 ? hunk.newStart - 1 : 0))
      lines.splice(insertAt, 0, ...oldLines)
      continue
    }

    const start = hunk.newStart > 0 ? hunk.newStart - 1 : 0
    if (!linesMatchAt(lines, start, newLines)) return false
    lines.splice(start, newLines.length, ...oldLines)
  }
  return true
}

function reverseApplyHunksBySearch(lines: string[], hunks: UnifiedDiffHunk[]): boolean {
  for (let i = hunks.length - 1; i >= 0; i--) {
    const hunk = hunks[i]!
    const oldLines = hunkSideLines(hunk, 'old')
    const newLines = hunkSideLines(hunk, 'new')
    const preferredStart = hunk.newStart > 0 ? hunk.newStart - 1 : 0

    if (newLines.length === 0) {
      const insertAt = Math.max(0, Math.min(lines.length, preferredStart))
      lines.splice(insertAt, 0, ...oldLines)
      continue
    }

    const found = findContiguousLines(lines, newLines, preferredStart)
    if (found < 0) return false
    lines.splice(found, newLines.length, ...oldLines)
  }
  return true
}

/**
 * Reverse-apply unified hunks onto a full modified document to recover the original.
 * Tries the recorded newStart first, then searches for the new-side lines
 * (so a later insert above the hunk, or a stale line number, can still recover).
 */
export function reverseApplyHunksToModified(
  modified: string,
  hunks: UnifiedDiffHunk[]
): { original: string; ok: boolean } {
  const positioned = splitContentLines(modified)
  if (reverseApplyHunksAtRecordedStarts(positioned, hunks)) {
    return { original: joinContentLines(positioned), ok: true }
  }

  const searched = splitContentLines(modified)
  if (reverseApplyHunksBySearch(searched, hunks)) {
    return { original: joinContentLines(searched), ok: true }
  }

  return { original: '', ok: false }
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

  const fromHunks = documentsFromHunksAligned(parsed.hunks)

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
    // Disk no longer matches this hunk — keep recorded line numbers instead of
    // renumbering a 3-line snippet from 1.
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
