import type { EditorView } from '@codemirror/view'
import { parseTableFromDoc, serializeTable } from '../table.model'
import { readTableAlignmentsFromDoc } from '../table.ops'
import { allowTableStructureEdit } from '../tableEffects'
import { findCurrentTableRange } from '../tableDom'
import { findTableNodeBounds } from '../tableBounds'
import { readTableGridFromDesktopBlock } from './readDesktopGrid'
import { tableEditAnnotation } from './tableAnnotation'
import type { TableGridModel } from '../tableGridModel'

function buildMarkdownFromGrid(
  view: EditorView,
  tableFrom: number,
  model: TableGridModel
): { from: number; to: number; markdown: string } | null {
  const bounds = findTableNodeBounds(view.state, tableFrom)
  if (!bounds) return null
  const range = { from: bounds.table.from, to: bounds.table.to }
  const table = parseTableFromDoc(view.state.doc, range.from, range.to)
  if (!table) return null

  const alignments = readTableAlignmentsFromDoc(table, view.state.doc)
  const markdown = serializeTable(model.header, model.rows, model.alignments ?? alignments, {
    prettify: true
  })
  return { from: range.from, to: range.to, markdown }
}

/** 内存 grid → doc Markdown（resize 拖拽等不依赖 DOM 的场景） */
export function commitDesktopGridToDoc(
  view: EditorView,
  tableFrom: number,
  model: TableGridModel
): boolean {
  const built = buildMarkdownFromGrid(view, tableFrom, model)
  if (!built) return false
  const current = view.state.doc.sliceString(built.from, built.to)
  if (built.markdown === current) return false

  view.dispatch({
    changes: { from: built.from, to: built.to, insert: built.markdown },
    annotations: [allowTableStructureEdit.of(true), tableEditAnnotation.of(true)]
  })
  return true
}

/** widget DOM → doc Markdown（对齐 ckant TableDescription → dispatch） */
export function commitDesktopTableToDoc(view: EditorView, block: HTMLElement): boolean {
  const model = readTableGridFromDesktopBlock(block, view)
  if (!model) return false
  const tableFrom = Number(block.dataset.tableFrom)
  if (Number.isNaN(tableFrom)) {
    const range = findCurrentTableRange(view, block)
    if (!range) return false
    return commitDesktopGridToDoc(view, range.from, model)
  }
  return commitDesktopGridToDoc(view, tableFrom, model)
}
