import type { EditorView } from '@codemirror/view'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { logDiaryBridge } from '../diaryBridgeDebug'
import { findTableRangeAt, findTableToByFrom } from './tableBounds'
import { parseTableFromDoc } from './table.model'
import { clearActiveTableCellEffects } from './tableActiveCell'
import { blurTableCellEditor } from './tableDom'
import { placeCursorAfterTable } from './tableFocus'
import { findTableRowToForGapPos } from './tablePostGap'
import {
  findFencedCodeBlockContaining,
  shouldDeferTableCaretRedirect
} from '../extensions/fencedCodeScan'
import { editorFocusEffect } from '../extensions/editorFocus'
import { livePreviewRefreshEffect } from '../extensions/livePreviewPlugin'

const TABLE_BLOCK_ABOVE_TOLERANCE_PX = 72

/** 点击点上方、与点击点垂直距离最近的表格块 */
export function findTableBlockAbovePoint(view: EditorView, clientY: number): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestDistance = Infinity

  for (const block of view.dom.querySelectorAll('.cm-table-block')) {
    const el = block as HTMLElement
    const rect = el.getBoundingClientRect()
    if (rect.bottom > clientY + TABLE_BLOCK_ABOVE_TOLERANCE_PX) continue
    const distance = clientY - rect.bottom
    if (distance < bestDistance) {
      bestDistance = distance
      best = el
    }
  }

  return best
}

function resolveLineElementFromPointer(
  target: Element | null | undefined,
  clientX: number,
  clientY: number
): HTMLElement | null {
  const fromTarget = target?.closest('.cm-line')
  if (fromTarget instanceof HTMLElement) return fromTarget
  const hit = document.elementFromPoint(clientX, clientY)
  const fromHit = hit?.closest('.cm-line')
  return fromHit instanceof HTMLElement ? fromHit : null
}

function resolvePosFromLineTarget(
  view: EditorView,
  target: Element | null | undefined,
  clientX: number,
  clientY: number
): number | null {
  const coordsPos = view.posAtCoords({ x: clientX, y: clientY }, false)
  if (coordsPos != null) return coordsPos

  const lineEl = resolveLineElementFromPointer(target, clientX, clientY)
  if (!lineEl) return null
  try {
    const pos = view.posAtDOM(lineEl, 0)
    return pos >= 0 ? pos : null
  } catch {
    return null
  }
}

function redirectIfOnGapLine(view: EditorView, pos: number, reason: string): boolean {
  if (shouldDeferTableCaretRedirect(view.state.doc, pos)) return false
  ensureSyntaxTree(view.state, view.state.doc.length, 200)
  const tableRowTo = findTableRowToForGapPos(view.state, pos)
  if (tableRowTo == null) return false

  blurTableCellEditor()
  placeCursorAfterTable(view, tableRowTo)
  logDiaryBridge('tableTouch', 'redirect-gap-at-place', {
    reason,
    pos,
    tableRowTo,
    head: view.state.selection.main.head
  })
  return true
}

function redirectIfInsideTableNode(view: EditorView, pos: number): boolean {
  const doc = view.state.doc
  if (findFencedCodeBlockContaining(doc, pos)) return false
  if (shouldDeferTableCaretRedirect(doc, pos)) return false
  let redirected = false

  syntaxTree(view.state).iterate({
    enter(node) {
      if (redirected || node.type.name !== 'Table') return
      if (pos < node.from || pos >= node.to) return
      const table = parseTableFromDoc(doc, node.from, node.to)
      if (!table) return

      blurTableCellEditor()
      placeCursorAfterTable(view, table.to)
      redirected = true
      return false
    }
  })

  if (redirected) return true

  const range = findTableRangeAt(view.state, pos)
  if (!range) return false
  if (pos > range.rowTo && pos < range.nodeTo) {
    if (shouldDeferTableCaretRedirect(doc, pos, range)) return false
    blurTableCellEditor()
    placeCursorAfterTable(view, range.rowTo)
    return true
  }
  return false
}

function placeCaretAtPos(view: EditorView, pos: number, reason: string): boolean {
  if (redirectIfOnGapLine(view, pos, reason)) return true

  if (redirectIfInsideTableNode(view, pos)) {
    logDiaryBridge('tableTouch', 'redirect-from-coords', {
      reason,
      pos,
      head: view.state.selection.main.head
    })
    return true
  }

  blurTableCellEditor()
  const enteringFenced = findFencedCodeBlockContaining(view.state.doc, pos) != null
  const effects = [...clearActiveTableCellEffects(view.state), editorFocusEffect.of(true)]
  if (enteringFenced) {
    effects.push(livePreviewRefreshEffect.of(null))
  }
  view.dispatch({
    effects,
    selection: { anchor: pos, head: pos },
    scrollIntoView: false
  })
  view.focus()

  logDiaryBridge('tableTouch', 'place-at-coords', {
    reason,
    pos,
    head: view.state.selection.main.head
  })
  return true
}

function placeAfterTableBlock(
  view: EditorView,
  block: HTMLElement,
  reason: string
): boolean {
  const tableFrom = Number(block.dataset.tableFrom)
  if (Number.isNaN(tableFrom)) return false
  const tableRowTo = findTableToByFrom(view.state, tableFrom)
  if (tableRowTo == null) return false

  blurTableCellEditor()
  placeCursorAfterTable(view, tableRowTo)
  logDiaryBridge('tableTouch', 'place-after-block', {
    reason,
    tableFrom,
    tableRowTo,
    head: view.state.selection.main.head
  })
  return true
}

/** head 落在表格 markdown 区内时，移到表后正文（WebView 常不经 CM selectionSet 把 head 重置为 0） */
function redirectIfHeadStuckInTable(view: EditorView, reason: string): boolean {
  const head = view.state.selection.main.head
  if (findFencedCodeBlockContaining(view.state.doc, head)) return false
  const range = findTableRangeAt(view.state, head)
  if (!range || head > range.rowTo) return false

  blurTableCellEditor()
  placeCursorAfterTable(view, range.rowTo)
  logDiaryBridge('tableTouch', 'redirect-stuck-head', {
    reason,
    head,
    tableFrom: range.from,
    tableRowTo: range.rowTo
  })
  return true
}

/**
 * 触摸端把 CM 选区落到点击坐标（Android WebView 在块级 widget 下方常无法自动落点）。
 * 须在用户手势内同步调用。
 */
export function placeEditorCaretFromPointer(
  view: EditorView,
  clientX: number,
  clientY: number,
  reason: string,
  target?: Element | null
): boolean {
  // precise 是第二参数，不能写在 coords 对象里
  let coordsPos = view.posAtCoords({ x: clientX, y: clientY }, true)
  if (coordsPos == null) {
    coordsPos = view.posAtCoords({ x: clientX, y: clientY }, false)
  }

  if (coordsPos != null) {
    return placeCaretAtPos(view, coordsPos, reason)
  }

  const linePos = resolvePosFromLineTarget(view, target, clientX, clientY)
  if (linePos != null) {
    logDiaryBridge('tableTouch', 'place-from-line-dom', {
      reason,
      pos: linePos,
      head: view.state.selection.main.head
    })
    return placeCaretAtPos(view, linePos, reason)
  }

  const block = findTableBlockAbovePoint(view, clientY)
  if (block && placeAfterTableBlock(view, block, reason)) {
    return true
  }

  if (redirectIfHeadStuckInTable(view, reason)) {
    return true
  }

  logDiaryBridge('tableTouch', 'place-failed', {
    reason,
    clientX,
    clientY,
    head: view.state.selection.main.head,
    docLen: view.state.doc.length,
    tableBlocks: view.dom.querySelectorAll('.cm-table-block').length,
    targetClass:
      target instanceof Element ? target.className?.slice?.(0, 40) ?? '' : ''
  })
  return false
}
