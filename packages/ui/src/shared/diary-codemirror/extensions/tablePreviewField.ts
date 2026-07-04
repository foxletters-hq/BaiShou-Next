import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  StateField,
  type EditorState,
  type Extension,
  type Transaction,
  type Range
} from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { forceTableRefresh, allowTableStructureEdit } from '../table/tableEffects'
import {
  activeTableCellField,
  readActiveTableCellFor,
  setActiveTableCell
} from '../table/tableActiveCell'
import { readTableChromeSelectionFor, setTableChromeSelection } from '../table/tableChromeSelection'
import {
  readTableCellRangeSelectionFor,
  setTableCellRangeSelection
} from '../table/tableRangeSelection'
import { resolveTableSurfaceRange, tableSyntaxTreeTablesChanged } from '../table/tableBounds'
import { TableBlockWidget } from '../widgets/TableBlockWidget'
import { TableDesktopWidget } from '../widgets/TableDesktopWidget'
import { readTableAlignmentsFromDoc } from '../table/table.ops'
import { diarySyntaxTreeGrowthEffect } from './diarySyntaxTreeGrowth'
import { desktopTableInteractionField } from '../table/desktop/tableInteractionField'
import type { DiaryCmPlatform } from '../types'
import { logTableDesktop } from '../table/tableDesktopDebug'

function isCellTextCommit(tr: Transaction): boolean {
  return (
    tr.docChanged &&
    tr.annotation(allowTableStructureEdit) === true &&
    !tr.effects.some((e) => e.is(forceTableRefresh))
  )
}

function tablePreviewEffects(tr: Transaction, platform?: DiaryCmPlatform): boolean {
  if (platform?.interactionMode === 'touch' && tr.selection !== undefined) return true
  const hasForceRefresh = tr.effects.some((e) => e.is(forceTableRefresh))
  const hasSyntaxGrowth = tr.effects.some((e) => e.is(diarySyntaxTreeGrowthEffect))
  if (hasForceRefresh || hasSyntaxGrowth) {
    // 单元格编辑中：语法树推进不应重建 widget，否则嵌套 CM 被销毁无法继续输入
    if (
      platform?.interactionMode === 'mouse' &&
      hasSyntaxGrowth &&
      !hasForceRefresh &&
      !tr.docChanged
    ) {
      const interaction = tr.state.field(desktopTableInteractionField, false)
      if (interaction?.mode === 'cell') return false
    }
    return true
  }
  return false
}

function needsFullSyntaxParse(tr: Transaction): boolean {
  if (tr.docChanged) return true
  return tr.effects.some((e) => e.is(diarySyntaxTreeGrowthEffect) || e.is(forceTableRefresh))
}

/** 文档变更是否与已有表装饰区间重叠 */
export function changeOverlapsTableDecorations(tr: Transaction, existing: DecorationSet): boolean {
  let overlaps = false
  tr.changes.iterChanges((fromA, toA) => {
    if (overlaps) return
    const overlapEnd = Math.max(toA, fromA + 1)
    existing.between(fromA, overlapEnd, () => {
      overlaps = true
      return false
    })
  })
  return overlaps
}

/** 文档变更是否可能影响表格（装饰重叠或 Table 语法树区间变化） */
export function changeAffectsTables(tr: Transaction, existing: DecorationSet): boolean {
  if (changeOverlapsTableDecorations(tr, existing)) return true
  if (tr.docChanged && tableSyntaxTreeTablesChanged(tr)) return true
  return false
}

/** 构建表格 Live Preview 块级 replace 装饰（整表 widget，行边界覆盖） */
export function buildTablePreviewDecorations(
  state: EditorState,
  platform?: DiaryCmPlatform,
  options?: { ensureParse?: boolean }
): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const seenReplaceFrom = new Set<number>()
  const tree =
    options?.ensureParse === false
      ? syntaxTree(state)
      : (ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state))

  tree.iterate({
    enter(node) {
      if (node.name !== 'Table') return

      const surface = resolveTableSurfaceRange(state, node.from, node.to)
      if (!surface) return
      if (seenReplaceFrom.has(surface.replaceFrom)) return
      seenReplaceFrom.add(surface.replaceFrom)

      const activeCell = readActiveTableCellFor(state, surface.table.from)
      const chromeSelection = readTableChromeSelectionFor(state, surface.table.from)
      const rangeSelection = readTableCellRangeSelectionFor(state, surface.table.from)
      const alignments = readTableAlignmentsFromDoc(surface.table, state.doc)
      const isDesktop = platform?.interactionMode === 'mouse'
      const widget = isDesktop
        ? new TableDesktopWidget(surface.table, platform, alignments)
        : new TableBlockWidget(
            surface.table,
            activeCell,
            platform,
            chromeSelection,
            rangeSelection
          )

      ranges.push(
        Decoration.replace({
          widget,
          block: true
        }).range(surface.replaceFrom, surface.replaceTo)
      )
      return false
    }
  })

  return Decoration.set(ranges, true)
}

/** 表格 WYSIWYG 独立 StateField（与 livePreviewPlugin 装饰合并渲染） */
export function tablePreviewField(platform?: DiaryCmPlatform): Extension {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildTablePreviewDecorations(state, platform, { ensureParse: true })
    },
    update(deco, tr) {
      if (tablePreviewEffects(tr, platform)) {
        logTableDesktop('preview:rebuild-effects', {
          docChanged: tr.docChanged,
          activeCell: tr.state.field(activeTableCellField, false)
        })
        return buildTablePreviewDecorations(tr.state, platform, {
          ensureParse: needsFullSyntaxParse(tr)
        })
      }
      if (!tr.docChanged) return deco
      // 单元格逐字编辑：DOM 为真源，仅平移装饰区间，禁止重建 widget（否则 contenteditable 失焦）
      if (isCellTextCommit(tr)) {
        logTableDesktop('preview:map-cell-commit', {
          activeCell: tr.state.field(activeTableCellField, false)
        })
        return deco.map(tr.changes)
      }
      if (!changeAffectsTables(tr, deco)) {
        return deco.map(tr.changes)
      }
      logTableDesktop('preview:rebuild-doc', {
        activeCell: tr.state.field(activeTableCellField, false)
      })
      return buildTablePreviewDecorations(tr.state, platform, { ensureParse: true })
    },
    provide: (f) => EditorView.decorations.from(f)
  })
}
