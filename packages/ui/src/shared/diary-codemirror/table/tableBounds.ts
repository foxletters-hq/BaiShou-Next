import type { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { parseTableFromDoc, type ParsedTable } from './table.model'

export interface TableNodeBounds {
  nodeFrom: number
  nodeTo: number
  table: ParsedTable
}

/** 按表头行起始位置查找 Lezer Table 节点的完整文档区间 */
export function findTableNodeBounds(
  state: EditorState,
  pipeTableFrom: number
): TableNodeBounds | null {
  const tree = syntaxTree(state)
  let found: TableNodeBounds | null = null
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      const table = parseTableFromDoc(state.doc, node.from, node.to)
      if (!table || table.from !== pipeTableFrom) return
      found = { nodeFrom: node.from, nodeTo: node.to, table }
      return false
    }
  })
  return found
}

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

export function collectTableMarkdownRanges(state: EditorState): { from: number; to: number }[] {
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

export function rangeOverlapsTableMarkdown(state: EditorState, from: number, to: number): boolean {
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  return collectTableMarkdownRanges(state).some((r) => start <= r.to && end >= r.from)
}

export function findTableToByFrom(state: EditorState, tableFrom: number): number | null {
  const bounds = findTableNodeBounds(state, tableFrom)
  return bounds?.table.to ?? null
}

export function findTableNodeEndByFrom(state: EditorState, tableFrom: number): number | null {
  const bounds = findTableNodeBounds(state, tableFrom)
  return bounds?.nodeTo ?? null
}

/** widget / atomic / 装饰层统一使用的表块表面区间 */
export interface TableSurfaceRange {
  nodeFrom: number
  nodeTo: number
  replaceFrom: number
  replaceTo: number
  table: ParsedTable
}

export function resolveTableSurfaceRange(
  state: EditorState,
  nodeFrom: number,
  nodeTo: number
): TableSurfaceRange | null {
  const doc = state.doc
  const table = parseTableFromDoc(doc, nodeFrom, nodeTo)
  if (!table) return null
  const startLine = doc.lineAt(nodeFrom)
  const endLine = doc.lineAt(nodeTo)
  return {
    nodeFrom,
    nodeTo,
    replaceFrom: startLine.from,
    replaceTo: endLine.to,
    table
  }
}

export function collectTableSurfaceRanges(state: EditorState): TableSurfaceRange[] {
  const tree = syntaxTree(state)
  const ranges: TableSurfaceRange[] = []
  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      const surface = resolveTableSurfaceRange(state, node.from, node.to)
      if (surface) ranges.push(surface)
    }
  })
  return ranges
}

function collectTableNodeKeys(state: EditorState): string[] {
  const keys: string[] = []
  syntaxTree(state).iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      keys.push(`${node.from}:${node.to}`)
    }
  })
  return keys.sort()
}

/** Lezer Table 节点区间是否因本次事务发生变化 */
export function tableSyntaxTreeTablesChanged(tr: import('@codemirror/state').Transaction): boolean {
  if (syntaxTree(tr.state) === syntaxTree(tr.startState)) return false
  const before = collectTableNodeKeys(tr.startState)
  const after = collectTableNodeKeys(tr.state)
  if (before.length !== after.length) return true
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) return true
  }
  return false
}
