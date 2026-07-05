import { ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { setActiveTableCell } from '../table/tableActiveCell'
import { setTableCellEditing } from '../table/tableCellEditing'
import { setTableChromeSelection } from '../table/tableChromeSelection'
import { setTableCellRangeSelection } from '../table/tableRangeSelection'
import { forceTableRefresh } from '../table/tableEffects'
import { syncAllTableBlocks } from '../table/tableWidgetSync'
import type { DiaryCmPlatform } from '../types'

function shouldSyncTableUi(update: ViewUpdate): boolean {
  return update.transactions.some((tr) =>
    tr.effects.some(
      (e) =>
        e.is(setActiveTableCell) ||
        e.is(setTableCellEditing) ||
        e.is(setTableChromeSelection) ||
        e.is(setTableCellRangeSelection) ||
        e.is(forceTableRefresh)
    )
  )
}

/** 表格 UI 增量同步：切换活动格 / 框选 / 行列表头时不再重建 widget DOM */
export function tableWidgetSyncPlugin(_platform?: DiaryCmPlatform): Extension {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (!shouldSyncTableUi(update)) return
        syncAllTableBlocks(update.view)
      }
    }
  )
}
