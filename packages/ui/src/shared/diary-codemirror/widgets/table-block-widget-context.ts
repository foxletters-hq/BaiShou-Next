import type { EditorView } from '@codemirror/view'
import type { ParsedTable } from '../table/table.model'
import type { ActiveTableCell } from '../table/tableActiveCell'
import type { DiaryCmPlatform } from '../types'
import type { TableChromeSelection } from '../table/tableChromeSelection'
import type { TableCellRangeSelection } from '../table/tableRangeSelection'
import type { ColumnAlignment } from '../table/tableGridModel'
import { commitTableCellEditors } from '../table/tableWidgetSync'
import { findCurrentTableRange } from '../table/tableDom'
import { invokeTableAction, type TableEditorAction } from '../table/tableEffects'

/**
 * 抽出的 DOM / 交互函数不持有 WidgetType：
 * 否则 toDOM / eq / destroy 的实例状态会和纯函数互相缠绕，后续再拆只能继续切行。
 */
export type TableBlockWidgetContext = {
  table: ParsedTable
  activeCell: ActiveTableCell | null
  platform?: DiaryCmPlatform
  chromeSelection: TableChromeSelection | null
  rangeSelection: TableCellRangeSelection | null
  columnAlignments: ColumnAlignment[]
  getRootEl: () => HTMLElement | null
  editorView: () => EditorView | null
}

/** 提交当前格编辑：菜单、快捷键、失焦共用同一入口，避免漏 dispatch。 */
export function commitFocusedCell(ctx: TableBlockWidgetContext): void {
  const root = ctx.getRootEl()
  if (!root) return
  const view = ctx.editorView()
  if (!view) return
  commitTableCellEditors(root, view)
}

/** 结构变更必须先按当前 DOM 校正 from/to，避免 widget 重建后仍用旧区间。 */
export function runTableBlockAction(ctx: TableBlockWidgetContext, action: TableEditorAction): void {
  const view = ctx.editorView()
  const root = ctx.getRootEl()
  if (!view || !root) return
  const range = findCurrentTableRange(view, root)
  if (!range) return
  invokeTableAction(view, { ...action, tableFrom: range.from, tableTo: range.to })
}
