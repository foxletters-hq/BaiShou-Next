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
  const beforeLines = before.length === 0 ? [] : before.split('\n')
  const afterLines = after.length === 0 ? [] : after.split('\n')
  const remaining = new Map<string, number>()

  for (const line of beforeLines) {
    remaining.set(line, (remaining.get(line) ?? 0) + 1)
  }

  let matched = 0
  for (const line of afterLines) {
    const count = remaining.get(line) ?? 0
    if (count > 0) {
      matched++
      remaining.set(line, count - 1)
    }
  }

  return {
    deletions: beforeLines.length - matched,
    additions: afterLines.length - matched
  }
}

export function buildUnifiedDiff(path: string, before: string, after: string): string {
  if (before === after) return ''

  const beforeLines = before.length === 0 ? [] : before.split('\n')
  const afterLines = after.length === 0 ? [] : after.split('\n')
  const lines: string[] = [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${Math.max(beforeLines.length, 1)} +1,${Math.max(afterLines.length, 1)} @@`
  ]

  for (const line of beforeLines) {
    lines.push(`-${line}`)
  }
  for (const line of afterLines) {
    lines.push(`+${line}`)
  }

  return lines.join('\n')
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
  if (!content) return 0
  const lines = content.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines.length
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
