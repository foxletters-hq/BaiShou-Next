import type { EditorState, Text } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { parseTableFromDoc } from './table.model'

/** 文档最后一行是否为空白行（参考 Live Preview 编辑器的尾部空行约定） */
export function hasTerminalBlankLine(doc: Text): boolean {
  if (doc.lines === 0) return false
  return doc.line(doc.lines).text.length === 0
}

/** 表格结束位置对应的文档行 */
export function tableClosingLine(doc: Text, tableTo: number) {
  return doc.lineAt(Math.min(Math.max(tableTo, 0), doc.length))
}

/** 表后用于输入的文档位置：落在 gap 空白行之后的正文行，不在 gap 行上输入 */
export function resolvePostTableCursor(
  doc: Text,
  tableTo: number
): { cursor: number; change?: { from: number; insert: string } } {
  const boundedTo = Math.min(Math.max(tableTo, 0), doc.length)
  const closing = tableClosingLine(doc, boundedTo)
  const gapLineNum = closing.number + 1

  if (gapLineNum > doc.lines) {
    return {
      cursor: doc.length + 1,
      change: { from: doc.length, insert: '\n' }
    }
  }

  const gapLine = doc.line(gapLineNum)

  if (gapLine.text.trim().length !== 0) {
    return {
      cursor: gapLine.from + 1,
      change: { from: gapLine.from, insert: '\n' }
    }
  }

  if (gapLineNum < doc.lines) {
    return { cursor: doc.line(gapLineNum + 1).from }
  }

  return {
    cursor: doc.length + 1,
    change: { from: doc.length, insert: '\n' }
  }
}

/** 光标是否落在表后结构性空白 gap 行（用户不应在此行输入） */
export function isOnStructuralTableGapLine(doc: Text, head: number, tableRowTo: number): boolean {
  if (head <= tableRowTo) return false
  const closing = tableClosingLine(doc, tableRowTo)
  const gapLineNum = closing.number + 1
  if (gapLineNum > doc.lines) return false
  const gapLine = doc.line(gapLineNum)
  if (gapLine.text.trim().length !== 0) return false
  try {
    return doc.lineAt(head).number === gapLineNum
  } catch {
    return false
  }
}

/** 表后是否存在空白 gap 行（用于装饰） */
export function hasPostTableGapLine(doc: Text, tableTo: number): boolean {
  const closing = tableClosingLine(doc, tableTo)
  if (closing.number >= doc.lines) return false
  const nextLine = doc.line(closing.number + 1)
  return nextLine.text.trim().length === 0
}

/**
 * 表后缺少空行时插入换行，避免 GFM 把后续段落解析进 Table 节点。
 * 返回应在 tableTo 处应用的变更；无需变更时返回 null。
 */
export function postTableSeparatorChange(
  doc: Text,
  tableTo: number
): { from: number; insert: string } | null {
  return collectPostTableGapRepairs(doc, tableTo)[0] ?? null
}

/** 表格最后一行管道符行之后必须紧跟一行空白 gap；否则在违规行首插入换行 */
export function collectPostTableGapRepairs(
  doc: Text,
  tableTo: number
): { from: number; insert: string }[] {
  const repairs: { from: number; insert: string }[] = []

  const boundedTo = Math.min(Math.max(tableTo, 0), doc.length)
  const closing = tableClosingLine(doc, boundedTo)
  const gapLineNum = closing.number + 1

  if (gapLineNum > doc.lines) {
    if (!hasTerminalBlankLine(doc)) {
      repairs.push({ from: doc.length, insert: '\n' })
    }
    return repairs
  }

  const gapLine = doc.line(gapLineNum)
  if (gapLine.text.trim().length !== 0) {
    repairs.push({ from: gapLine.from, insert: '\n' })
  }

  return repairs
}

export function collectPostTableGapRepairsForState(
  state: EditorState
): { from: number; insert: string }[] {
  const repairs: { from: number; insert: string }[] = []
  const seenTableTo = new Set<number>()
  const tree = syntaxTree(state)

  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      const table = parseTableFromDoc(state.doc, node.from, node.to)
      if (!table || seenTableTo.has(table.to)) return
      seenTableTo.add(table.to)
      repairs.push(...collectPostTableGapRepairs(state.doc, table.to))
    }
  })

  return repairs.sort((a, b) => b.from - a.from)
}
