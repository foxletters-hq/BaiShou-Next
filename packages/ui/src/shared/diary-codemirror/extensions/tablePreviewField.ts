import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  StateField,
  type EditorState,
  type Extension,
  type Transaction
} from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  type Range
} from '@codemirror/view'
import { forceTableRefresh } from '../table/tableEffects'
import { activeTableCellField, readActiveTableCellFor, setActiveTableCell } from '../table/tableActiveCell'
import {
  readTableChromeSelectionFor,
  setTableChromeSelection
} from '../table/tableChromeSelection'
import {
  resolveTableSurfaceRange,
  tableSyntaxTreeTablesChanged
} from '../table/tableBounds'
import { TableBlockWidget } from '../widgets/TableBlockWidget'
import { diarySyntaxTreeGrowthEffect } from './diarySyntaxTreeGrowth'
import type { DiaryCmPlatform } from '../types'

function tablePreviewEffects(tr: Transaction): boolean {
  if (
    tr.effects.some(
      (e) =>
        e.is(forceTableRefresh) ||
        e.is(setTableChromeSelection) ||
        e.is(diarySyntaxTreeGrowthEffect)
    )
  ) {
    return true
  }
  for (const effect of tr.effects) {
    if (!effect.is(setActiveTableCell)) continue
    const prev = tr.startState.field(activeTableCellField, false)
    const next = effect.value
    if (
      prev?.tableFrom !== next?.tableFrom ||
      prev?.rowIndex !== next?.rowIndex ||
      prev?.colIndex !== next?.colIndex
    ) {
      return true
    }
  }
  return false
}

function needsFullSyntaxParse(tr: Transaction): boolean {
  if (tr.docChanged) return true
  return tr.effects.some((e) => e.is(diarySyntaxTreeGrowthEffect) || e.is(forceTableRefresh))
}

/** 文档变更是否与已有表装饰区间重叠 */
export function changeOverlapsTableDecorations(
  tr: Transaction,
  existing: DecorationSet
): boolean {
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
  const tree =
    options?.ensureParse === false
      ? syntaxTree(state)
      : (ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state))

  tree.iterate({
    enter(node) {
      if (node.name !== 'Table') return

      const surface = resolveTableSurfaceRange(state, node.from, node.to)
      if (!surface) return

      const activeCell = readActiveTableCellFor(state, surface.table.from)
      const chromeSelection = readTableChromeSelectionFor(state, surface.table.from)

      ranges.push(
        Decoration.replace({
          widget: new TableBlockWidget(surface.table, activeCell, platform, chromeSelection),
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
      if (tablePreviewEffects(tr)) {
        return buildTablePreviewDecorations(tr.state, platform, {
          ensureParse: needsFullSyntaxParse(tr)
        })
      }
      if (!tr.docChanged) return deco
      if (!changeAffectsTables(tr, deco)) {
        return deco.map(tr.changes)
      }
      return buildTablePreviewDecorations(tr.state, platform, { ensureParse: true })
    },
    provide: (f) => EditorView.decorations.from(f)
  })
}
