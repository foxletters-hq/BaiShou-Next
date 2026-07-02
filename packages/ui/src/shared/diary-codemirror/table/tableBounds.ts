import type { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { parseTableFromDoc } from './table.model'

export interface TableRangeAt {
  from: number
  /** 最后一行管道符表格行的结束位置（不含被 GFM 误吞的后续段落） */
  rowTo: number
  nodeTo: number
}

export function findTableRangeAt(state: EditorState, pos: number): TableRangeAt | null {
  const tree = syntaxTree(state)
  let found: TableRangeAt | null = null
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      if (pos < node.from || pos >= node.to) return
      const table = parseTableFromDoc(state.doc, node.from, node.to)
      if (!table) return
      if (pos > table.to) return
      found = { from: table.from, rowTo: table.to, nodeTo: node.to }
      return false
    }
  })
  return found
}

export function collectTableMarkdownRanges(
  state: EditorState
): { from: number; to: number }[] {
  const tree = syntaxTree(state)
  const ranges: { from: number; to: number }[] = []
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      const table = parseTableFromDoc(state.doc, node.from, node.to)
      if (table) ranges.push({ from: table.from, to: table.to })
    }
  })
  return ranges
}

export function rangeOverlapsTableMarkdown(
  state: EditorState,
  from: number,
  to: number
): boolean {
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  return collectTableMarkdownRanges(state).some((r) => start <= r.to && end >= r.from)
}

export function findTableToByFrom(state: EditorState, tableFrom: number): number | null {
  const tree = syntaxTree(state)
  let found: number | null = null
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      if (node.from !== tableFrom) return
      const table = parseTableFromDoc(state.doc, node.from, node.to)
      if (table) found = table.to
      return false
    }
  })
  return found
}
