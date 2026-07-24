import type { FileChangeKind, FileChangePartData } from '@baishou/shared'

export interface BuildFileChangePartInput {
  path: string
  kind: FileChangeKind
  beforeContent?: string | null
  afterContent?: string | null
  toolCallId?: string
  roundCheckpointId?: string
  previousPath?: string
  previewMaxLength?: number
}

export function computeLineDiffStats(
  before: string,
  after: string
): { additions: number; deletions: number } {
  const beforeLines = splitLines(before)
  const afterLines = splitLines(after)
  const ops = computeLineOps(beforeLines, afterLines)
  let additions = 0
  let deletions = 0
  for (const op of ops) {
    if (op.type === 'add') additions++
    if (op.type === 'remove') deletions++
  }
  return { additions, deletions }
}

/**
 * Build a context-aware unified diff (≈3 lines of context around hunks).
 * Replaces the previous whole-file delete+add simplification.
 */
export function buildUnifiedDiff(
  path: string,
  before: string,
  after: string,
  options?: { context?: number; maxDiffChars?: number }
): string {
  if (before === after) return ''

  const context = options?.context ?? 3
  const maxDiffChars = options?.maxDiffChars
  const beforeLines = splitLines(before)
  const afterLines = splitLines(after)
  const ops = computeLineOps(beforeLines, afterLines)
  const hunks = groupOpsIntoHunks(ops, context)

  const lines: string[] = [`--- a/${path}`, `+++ b/${path}`]
  for (const hunk of hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`)
    for (const line of hunk.lines) {
      lines.push(line)
    }
  }

  let result = lines.join('\n')
  if (maxDiffChars != null && result.length > maxDiffChars) {
    result = `${result.slice(0, maxDiffChars)}\n… (diff truncated)`
  }
  return result
}

export interface BuildUnifiedDiffResult {
  diff: string
  truncated: boolean
  additions: number
  deletions: number
}

export function buildUnifiedDiffWithLimit(
  path: string,
  before: string,
  after: string,
  maxDiffChars = 24_000
): BuildUnifiedDiffResult {
  const stats = computeLineDiffStats(before, after)
  const full = buildUnifiedDiff(path, before, after, { context: 3 })
  if (!full) {
    return { diff: '', truncated: false, ...stats }
  }
  if (full.length <= maxDiffChars) {
    return { diff: full, truncated: false, ...stats }
  }
  return {
    diff: buildUnifiedDiff(path, before, after, { context: 3, maxDiffChars }),
    truncated: true,
    ...stats
  }
}

type LineOp =
  | { type: 'equal'; line: string; oldIndex: number; newIndex: number }
  | { type: 'remove'; line: string; oldIndex: number }
  | { type: 'add'; line: string; newIndex: number }

interface DiffHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: string[]
}

function splitLines(content: string): string[] {
  if (content.length === 0) return []
  const lines = content.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

/** Myers-inspired LCS edit script for line arrays */
function computeLineOps(beforeLines: string[], afterLines: string[]): LineOp[] {
  const n = beforeLines.length
  const m = afterLines.length
  if (n === 0 && m === 0) return []
  if (n === 0) {
    return afterLines.map((line, newIndex) => ({ type: 'add' as const, line, newIndex }))
  }
  if (m === 0) {
    return beforeLines.map((line, oldIndex) => ({ type: 'remove' as const, line, oldIndex }))
  }

  // DP LCS lengths — O(nm); fine for typical source files. Cap pathological size.
  const maxCells = 400_000
  if (n * m > maxCells) {
    return computeSimpleOpsFallback(beforeLines, afterLines)
  }

  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]!
    const nextRow = dp[i + 1]!
    for (let j = m - 1; j >= 0; j--) {
      if (beforeLines[i] === afterLines[j]) {
        row[j] = nextRow[j + 1]! + 1
      } else {
        row[j] = Math.max(nextRow[j]!, row[j + 1]!)
      }
    }
  }

  const ops: LineOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    const beforeLine = beforeLines[i]!
    const afterLine = afterLines[j]!
    if (beforeLine === afterLine) {
      ops.push({ type: 'equal', line: beforeLine, oldIndex: i, newIndex: j })
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ type: 'remove', line: beforeLine, oldIndex: i })
      i++
    } else {
      ops.push({ type: 'add', line: afterLine, newIndex: j })
      j++
    }
  }
  while (i < n) {
    ops.push({ type: 'remove', line: beforeLines[i]!, oldIndex: i })
    i++
  }
  while (j < m) {
    ops.push({ type: 'add', line: afterLines[j]!, newIndex: j })
    j++
  }
  return ops
}

/** Prefix/suffix common + middle replace when LCS would be too large */
function computeSimpleOpsFallback(beforeLines: string[], afterLines: string[]): LineOp[] {
  let prefix = 0
  const n = beforeLines.length
  const m = afterLines.length
  while (prefix < n && prefix < m && beforeLines[prefix] === afterLines[prefix]) {
    prefix++
  }
  let suffix = 0
  while (
    suffix < n - prefix &&
    suffix < m - prefix &&
    beforeLines[n - 1 - suffix] === afterLines[m - 1 - suffix]
  ) {
    suffix++
  }

  const ops: LineOp[] = []
  for (let i = 0; i < prefix; i++) {
    ops.push({ type: 'equal', line: beforeLines[i]!, oldIndex: i, newIndex: i })
  }
  for (let i = prefix; i < n - suffix; i++) {
    ops.push({ type: 'remove', line: beforeLines[i]!, oldIndex: i })
  }
  for (let j = prefix; j < m - suffix; j++) {
    ops.push({ type: 'add', line: afterLines[j]!, newIndex: j })
  }
  for (let k = 0; k < suffix; k++) {
    const oldIndex = n - suffix + k
    const newIndex = m - suffix + k
    ops.push({
      type: 'equal',
      line: beforeLines[oldIndex]!,
      oldIndex,
      newIndex
    })
  }
  return ops
}

function groupOpsIntoHunks(ops: LineOp[], context: number): DiffHunk[] {
  if (ops.length === 0) return []

  const changeIndexes: number[] = []
  for (let i = 0; i < ops.length; i++) {
    if (ops[i]!.type !== 'equal') changeIndexes.push(i)
  }
  if (changeIndexes.length === 0) return []

  type Range = { start: number; end: number }
  const ranges: Range[] = []
  let rangeStart = Math.max(0, changeIndexes[0]! - context)
  let rangeEnd = Math.min(ops.length - 1, changeIndexes[0]! + context)
  for (let c = 1; c < changeIndexes.length; c++) {
    const changeIndex = changeIndexes[c]!
    const nextStart = Math.max(0, changeIndex - context)
    const nextEnd = Math.min(ops.length - 1, changeIndex + context)
    if (nextStart <= rangeEnd + 1) {
      rangeEnd = Math.max(rangeEnd, nextEnd)
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd })
      rangeStart = nextStart
      rangeEnd = nextEnd
    }
  }
  ranges.push({ start: rangeStart, end: rangeEnd })

  return ranges.map((range) => buildHunk(ops, range.start, range.end))
}

function buildHunk(ops: LineOp[], start: number, end: number): DiffHunk {
  let oldStart = 1
  let newStart = 1
  for (let i = 0; i < start; i++) {
    const op = ops[i]!
    if (op.type === 'equal' || op.type === 'remove') oldStart++
    if (op.type === 'equal' || op.type === 'add') newStart++
  }

  let oldCount = 0
  let newCount = 0
  const lines: string[] = []
  for (let i = start; i <= end; i++) {
    const op = ops[i]!
    if (op.type === 'equal') {
      lines.push(` ${op.line}`)
      oldCount++
      newCount++
    } else if (op.type === 'remove') {
      lines.push(`-${op.line}`)
      oldCount++
    } else {
      lines.push(`+${op.line}`)
      newCount++
    }
  }

  if (oldCount === 0) {
    // Pure insertion: unified diff uses oldStart of the line before insertion
    oldStart = Math.max(oldStart - 1, 0)
  }
  if (newCount === 0) {
    newStart = Math.max(newStart - 1, 0)
  }

  return {
    oldStart: Math.max(oldStart, 0),
    oldCount,
    newStart: Math.max(newStart, 0),
    newCount,
    lines
  }
}

function buildPreview(
  kind: FileChangeKind,
  afterContent: string | null | undefined,
  previousPath: string | undefined,
  maxLength: number
): string | undefined {
  if (kind === 'rename' && previousPath) {
    return `Renamed from ${previousPath}`
  }
  if (kind === 'delete') {
    return undefined
  }
  if (!afterContent) {
    return undefined
  }
  const trimmed = afterContent.trim()
  if (!trimmed) return undefined
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength)}…`
}

function countContentLines(content: string): number {
  return splitLines(content).length
}

export function buildFileChangePartData(input: BuildFileChangePartInput): FileChangePartData {
  const before = input.beforeContent ?? ''
  const after = input.afterContent ?? ''
  const previewMaxLength = input.previewMaxLength ?? 240

  let additions = 0
  let deletions = 0

  if (input.kind === 'create') {
    additions = countContentLines(after)
  } else if (input.kind === 'delete') {
    deletions = countContentLines(before)
  } else if (input.kind === 'rename') {
    additions = 0
    deletions = 0
  } else {
    const stats = computeLineDiffStats(before, after)
    additions = stats.additions
    deletions = stats.deletions
  }

  const diff =
    input.kind === 'modify' || input.kind === 'create'
      ? buildUnifiedDiff(input.path, before, after)
      : input.kind === 'delete'
        ? buildUnifiedDiff(input.path, before, '')
        : undefined

  return {
    path: input.path,
    kind: input.kind,
    additions,
    deletions,
    preview: buildPreview(input.kind, after, input.previousPath, previewMaxLength),
    diff: diff && diff.length > 0 ? diff : undefined,
    toolCallId: input.toolCallId,
    roundCheckpointId: input.roundCheckpointId,
    previousPath: input.previousPath
  }
}
