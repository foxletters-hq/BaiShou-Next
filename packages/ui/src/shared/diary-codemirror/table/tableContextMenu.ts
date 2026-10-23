import i18n from 'i18next'
import type { StateEffect } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { ParsedTable } from './table.model'
import { setActiveTableCell } from './tableActiveCell'
import { invokeTableAction } from './tableEffects'
import { setTableChromeSelection, clearTableChromeSelection } from './tableChromeSelection'
import { logTableChrome } from './tableChromeDebug'
import { isTableSheetOpen } from './tableSheetInteraction'
import { blurActiveTableCellInput, dismissEditorKeyboardForChrome } from './tableChromeKeyboard'
import {
  copyTableMarkdownFromBlock,
  findCurrentTableRange,
  readTableModelFromBlock,
  writeTextToClipboard
} from './tableDom'
import {
  buildCellContextMenuSections,
  buildColMenuItems,
  buildColMenuSections,
  buildRowMenuItems,
  buildRowMenuSections
} from './table-context-menu-items'
import { runCellContextMenuAction, runChromeMenuAction } from './table-context-menu-actions'
import {
  getLastChromeMenuOpenAt,
  markChromeMenuOpened,
  MENU_LAYER_SELECTOR,
  showTableBottomSheet,
  showTableContextMenu
} from './table-context-menu-display'
import type { TableMenuSection } from './table-context-menu.types'

export type { TableMenuItem, TableMenuSection } from './table-context-menu.types'
export {
  buildCellContextMenuSections,
  buildColMenuItems,
  buildColMenuSections,
  buildRowMenuItems,
  buildRowMenuSections
} from './table-context-menu-items'
export { runCellContextMenuAction, runChromeMenuAction } from './table-context-menu-actions'
export { showTableBottomSheet, showTableContextMenu } from './table-context-menu-display'
export { blurActiveTableCellInput, dismissEditorKeyboardForChrome } from './tableChromeKeyboard'

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}

const CHROME_MENU_DEBOUNCE_MS = 280
let lastChromeTouchAt = 0
const CHROME_TOUCH_SELECTOR = '.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn'

export function isTableChromeTouchTarget(el: Element | null): HTMLElement | null {
  if (!el) return null
  return el.closest(CHROME_TOUCH_SELECTOR) as HTMLElement | null
}

/**
 * Android WebView：在 touchstart / pointerdown 立即响应，不等待 touchend（长按只会震动、菜单不出）。
 */
export function bindTouchChromeActivate(el: HTMLElement, action: () => void): void {
  const invoke = (e: Event) => {
    const label = el.className
    logTableChrome('bindTouchChromeActivate', {
      event: e.type,
      target: label,
      defaultPrevented: e.defaultPrevented
    })
    e.preventDefault()
    e.stopPropagation()
    const now = Date.now()
    if (now - lastChromeTouchAt < CHROME_MENU_DEBOUNCE_MS) {
      logTableChrome('bindTouchChromeActivate:debounced', { target: label })
      return
    }
    lastChromeTouchAt = now
    blurActiveTableCellInput()
    action()
  }

  el.addEventListener('touchstart', invoke, { passive: false, capture: true })
  el.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return
      invoke(e)
    },
    { capture: true }
  )
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
}

function shouldOpenChromeMenu(): boolean {
  if (isTableSheetOpen()) {
    logTableChrome('shouldOpenChromeMenu', { allow: false, reason: 'sheet-open' })
    return false
  }
  const now = Date.now()
  const hasOpenLayer = Boolean(document.querySelector(MENU_LAYER_SELECTOR))
  const debounceMs = hasOpenLayer ? CHROME_MENU_DEBOUNCE_MS : 60
  if (now - getLastChromeMenuOpenAt() < debounceMs) {
    logTableChrome('shouldOpenChromeMenu', { allow: false, reason: 'debounce', debounceMs })
    return false
  }
  markChromeMenuOpened()
  return true
}

export async function copyTableRowFromBlock(
  block: HTMLElement,
  rowIndex: number
): Promise<boolean> {
  const model = readTableModelFromBlock(block)
  if (!model || rowIndex < 0 || rowIndex >= model.rows.length) return false
  const line = `| ${model.rows[rowIndex]!.join(' | ')} |`
  return writeTextToClipboard(line)
}

/** 桌面端：单元格右键菜单 */
export function openTableCellContextMenu(
  view: EditorView,
  table: ParsedTable,
  rowIndex: number,
  colIndex: number,
  clientX: number,
  clientY: number
): void {
  if (!shouldOpenChromeMenu()) return
  blurActiveTableCellInput()
  const sections = buildCellContextMenuSections(table, rowIndex, colIndex)
  const items = sections.flatMap((s) => s.items)
  const title = rowIndex < 0 ? `第 ${colIndex + 1} 列` : `第 ${rowIndex + 1} 行`
  logTableChrome('openTableCellContextMenu', { rowIndex, colIndex, title })

  if (platformIsTouch(view)) {
    showTableBottomSheet(title, sections, (id) => {
      runCellContextMenuAction(view, table.from, table.to, rowIndex, colIndex, id)
    })
    return
  }

  showTableContextMenu(items, clientX, clientY, (id) => {
    runCellContextMenuAction(view, table.from, table.to, rowIndex, colIndex, id)
  })
}

function platformIsTouch(view: EditorView): boolean {
  return view.dom.closest('.cm-table-block--touch') != null
}

function isTouchTableBlock(trigger: HTMLElement): boolean {
  return Boolean(trigger.closest('.cm-table-block--touch'))
}

function setChromeSelection(
  view: EditorView,
  tableFrom: number,
  kind: 'col' | 'row',
  index: number,
  options?: { clearActiveCell?: boolean }
): void {
  const effects: StateEffect<unknown>[] = [setTableChromeSelection.of({ tableFrom, kind, index })]
  if (options?.clearActiveCell) {
    effects.push(setActiveTableCell.of(null))
  }
  view.dispatch({ effects })
}

export function openChromeMenuForTrigger(
  view: EditorView,
  trigger: HTMLElement,
  table: ParsedTable
): void {
  const touch = isTouchTableBlock(trigger)
  logTableChrome('openChromeMenuForTrigger', {
    trigger: trigger.className,
    touch,
    colIndex: trigger.dataset.colIndex,
    rowIndex: trigger.dataset.rowIndex
  })
  if (!shouldOpenChromeMenu()) {
    logTableChrome('openChromeMenuForTrigger:blocked')
    return
  }

  dismissEditorKeyboardForChrome(view)

  const rect = trigger.getBoundingClientRect()
  const x = rect.left
  const y = rect.bottom + 4
  const tableFrom = table.from
  const tableTo = table.to

  if (trigger.classList.contains('cm-table-add-row')) {
    invokeTableAction(view, { type: 'addRow', tableFrom, tableTo })
    return
  }
  if (trigger.classList.contains('cm-table-add-col')) {
    invokeTableAction(view, { type: 'addColumn', tableFrom, tableTo })
    return
  }

  if (trigger.classList.contains('cm-table-corner-menu')) {
    const block = trigger.closest('.cm-table-block') as HTMLElement | null
    const sections: TableMenuSection[] = [
      {
        items: [
          {
            id: 'copy-table',
            label: i18n.t(
              'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L892',
              '复制表格'
            )
          },
          {
            id: 'delete-table',
            label: i18n.t(
              'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L893',
              '删除表格'
            ),
            destructive: true
          }
        ]
      }
    ]
    const onPick = (id: string) => {
      if (id === 'copy-table') {
        if (block) void copyTableMarkdownFromBlock(view, block)
        return
      }
      if (id !== 'delete-table') return
      const range = block ? findCurrentTableRange(view, block) : null
      invokeTableAction(view, {
        type: 'deleteTable',
        tableFrom: range?.from ?? tableFrom,
        tableTo: range?.to ?? tableTo
      })
    }
    if (touch) {
      showTableBottomSheet(
        i18n.t('auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L911', '表格'),
        sections,
        onPick
      )
    } else {
      showTableContextMenu(sections[0]!.items, x, y, onPick)
    }
    return
  }

  if (trigger.classList.contains('cm-table-col-handle')) {
    const colIndex = Number(trigger.dataset.colIndex)
    if (Number.isNaN(colIndex)) return
    setChromeSelection(view, tableFrom, 'col', colIndex)
    const sections = buildColMenuSections(table, colIndex)
    const onPick = (id: string) => {
      runChromeMenuAction(view, tableFrom, tableTo, trigger, id)
    }
    if (touch) {
      showTableBottomSheet(`第 ${colIndex + 1} 列`, sections, onPick)
    } else {
      showTableContextMenu(buildColMenuItems(table, colIndex), x, y, (id) => {
        runChromeMenuAction(view, tableFrom, tableTo, trigger, id)
        clearTableChromeSelection(view)
      })
    }
    return
  }

  if (trigger.classList.contains('cm-table-row-handle')) {
    const rowIndex = Number(trigger.dataset.rowIndex)
    if (Number.isNaN(rowIndex)) return
    setChromeSelection(view, tableFrom, 'row', rowIndex)
    const sections = buildRowMenuSections(table, rowIndex)
    const title =
      rowIndex < 0
        ? i18n.t('auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L942', '表头')
        : `第 ${rowIndex + 1} 行`
    const onPick = (id: string) => {
      runChromeMenuAction(view, tableFrom, tableTo, trigger, id)
    }
    if (touch) {
      showTableBottomSheet(title, sections, onPick)
    } else {
      showTableContextMenu(buildRowMenuItems(table, rowIndex), x, y, (id) => {
        runChromeMenuAction(view, tableFrom, tableTo, trigger, id)
        clearTableChromeSelection(view)
      })
    }
  }
}
