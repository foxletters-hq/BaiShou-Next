import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { parseTableFromDoc } from '../table/table.model'
import { hasPostTableGapLine } from '../table/tablePostGap'
import { TableBlockWidget } from '../widgets/TableBlockWidget'
import { readActiveTableCellFor } from '../table/tableActiveCell'
import { readTableChromeSelectionFor } from '../table/tableChromeSelection'
import type { DiaryCmPlatform } from '../types'

export type TableBlockRange = { from: number; to: number }

/**
 * Live Preview 表格块：仅首行挂 widget，其余行折叠隐藏，表后空白行作为 gap 锚点。
 * （避免整块 replace 吞掉表后第一行的坐标映射）
 */
export function collectTableBlockWidgets(
  state: EditorState,
  _cursors: number[],
  marks: { from: number; to: number; value: Decoration }[],
  platform?: DiaryCmPlatform
): TableBlockRange[] {
  const tree = syntaxTree(state)
  const doc = state.doc
  const blocked: TableBlockRange[] = []

  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return

      const table = parseTableFromDoc(doc, node.from, node.to)
      if (!table) return

      const activeCell = readActiveTableCellFor(state, table.from)
      const chromeSelection = readTableChromeSelectionFor(state, table.from)
      const openingLine = doc.lineAt(table.from)
      const closingLine = doc.lineAt(table.to)

      blocked.push({ from: table.from, to: table.to })

      marks.push({
        from: openingLine.from,
        to: openingLine.from,
        value: Decoration.line({ attributes: { class: 'cm-table-anchor-line' } })
      })

      marks.push({
        from: openingLine.from,
        to: openingLine.to,
        value: Decoration.replace({
          widget: new TableBlockWidget(table, activeCell, platform, chromeSelection),
          block: true
        })
      })

      let hiddenLineFrom = openingLine.to + 1
      while (hiddenLineFrom <= closingLine.to) {
        const hiddenLine = doc.lineAt(hiddenLineFrom)
        marks.push({
          from: hiddenLine.from,
          to: hiddenLine.from,
          value: Decoration.line({ attributes: { class: 'cm-table-hidden-line' } })
        })
        marks.push({
          from: hiddenLine.from,
          to: hiddenLine.to,
          value: Decoration.replace({})
        })
        hiddenLineFrom = hiddenLine.to + 1
      }

      if (hasPostTableGapLine(doc, table.to)) {
        const gapLine = doc.line(closingLine.number + 1)
        marks.push({
          from: gapLine.from,
          to: gapLine.from,
          value: Decoration.line({ attributes: { class: 'cm-table-gap-line' } })
        })
      }
    }
  })

  return blocked
}

export function isPosInsideTableBlocks(pos: number, blocks: TableBlockRange[]): boolean {
  return blocks.some((b) => pos >= b.from && pos <= b.to)
}

export function rangeOverlapsTableBlocks(
  from: number,
  to: number,
  blocks: TableBlockRange[]
): boolean {
  return blocks.some((b) => from < b.to && to > b.from)
}
