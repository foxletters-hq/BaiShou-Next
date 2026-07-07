import type { Text } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'

export type DecorationMark = { from: number; to: number; value: Decoration }

export function isWidgetReplaceDecoration(deco: Decoration): boolean {
  return Boolean(deco.spec.widget)
}

export function isLineDecoration(deco: Decoration): boolean {
  return Boolean(deco.spec.line)
}

/** 含空 replace（无 widget）在内的 replace 装饰 */
export function isReplaceDecoration(deco: Decoration): boolean {
  if (isLineDecoration(deco)) return false
  if (isWidgetReplaceDecoration(deco)) return true
  const spec = deco.spec as Record<string, unknown>
  if (spec.block === true) return true
  if (typeof spec.class === 'string') return false
  if (spec.attributes) return false
  if ('inclusive' in spec) return false
  return true
}

export function rangesOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && bFrom < aTo
}

function canPushReplace(
  marks: DecorationMark[],
  from: number,
  to: number,
  deco: Decoration
): boolean {
  if (isWidgetReplaceDecoration(deco)) {
    return !marks.some(
      (m) => isWidgetReplaceDecoration(m.value) && rangesOverlap(m.from, m.to, from, to)
    )
  }
  return !marks.some((m) => isReplaceDecoration(m.value) && rangesOverlap(m.from, m.to, from, to))
}

/**
 * 对齐 atomic-editor：replace 不得跨行；多行 token 按行切段，widget 仅挂在第一段。
 */
export function pushReplaceDecoration(
  marks: DecorationMark[],
  doc: Text,
  from: number,
  to: number,
  spec: Parameters<typeof Decoration.replace>[0] = {}
): void {
  if (from >= to) return

  const emit = (
    segFrom: number,
    segTo: number,
    segSpec: Parameters<typeof Decoration.replace>[0]
  ) => {
    if (segFrom >= segTo) return
    const deco = Decoration.replace(segSpec)
    if (!canPushReplace(marks, segFrom, segTo, deco)) return
    marks.push(deco.range(segFrom, segTo))
  }

  const startLine = doc.lineAt(from)
  if (to <= startLine.to) {
    emit(from, to, spec)
    return
  }

  let cursor = from
  let firstSegment = true
  while (cursor < to) {
    const line = doc.lineAt(cursor)
    const segEnd = Math.min(to, line.to)
    emit(cursor, segEnd, firstSegment ? spec : {})
    firstSegment = false
    cursor = line.to + 1
  }
}

export function pushLineDecoration(
  marks: DecorationMark[],
  value: Decoration,
  lineFrom: number
): void {
  if (marks.some((m) => m.from === lineFrom && isLineDecoration(m.value))) return
  marks.push(value.range(lineFrom))
}

/** @deprecated 使用 pushReplaceDecoration */
export function pushWidgetReplace(
  marks: DecorationMark[],
  value: Decoration,
  from: number,
  to: number
): void {
  if (from >= to) return
  if (
    marks.some((m) => isWidgetReplaceDecoration(m.value) && rangesOverlap(m.from, m.to, from, to))
  ) {
    return
  }
  marks.push(value.range(from, to))
}

export function buildSafeDecorationSet(marks: DecorationMark[]): DecorationSet {
  const lineMarks: DecorationMark[] = []
  const markDecorations: DecorationMark[] = []
  const replaceMarks: DecorationMark[] = []

  for (const entry of marks) {
    if (isLineDecoration(entry.value)) {
      lineMarks.push(entry)
      continue
    }
    if (isReplaceDecoration(entry.value)) {
      replaceMarks.push(entry)
      continue
    }
    markDecorations.push(entry)
  }

  const keptLines: DecorationMark[] = []
  const lineFromSeen = new Set<number>()
  for (const entry of lineMarks) {
    if (lineFromSeen.has(entry.from)) continue
    lineFromSeen.add(entry.from)
    keptLines.push(entry)
  }

  const sortedReplaces = [...replaceMarks].sort((a, b) => a.from - b.from || a.to - b.to)
  const keptReplaces: DecorationMark[] = []
  for (const entry of sortedReplaces) {
    if (keptReplaces.some((kept) => rangesOverlap(kept.from, kept.to, entry.from, entry.to))) {
      continue
    }
    keptReplaces.push(entry)
  }

  return Decoration.set([...keptLines, ...markDecorations, ...keptReplaces], true)
}
