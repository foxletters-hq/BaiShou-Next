import type { StateEffect } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { ParsedTable } from './table.model'
import { setActiveTableCell } from './tableActiveCell'
import { invokeTableAction } from './tableEffects'
import { setTableChromeSelection, clearTableChromeSelection } from './tableChromeSelection'
import { logTableChrome } from './tableChromeDebug'
import { confirmMessageForDestructiveItem, requestTableConfirm } from './tableConfirm'
import {
  ensureTableSheetGlobalStyles,
  ensureTableContextMenuGlobalStyles
} from './tableSheetGlobalStyles'
import {
  dismissKeyboardForSheetInteraction,
  isTableSheetOpen,
  markTableSheetClosed,
  markTableSheetOpen
} from './tableSheetInteraction'
import { blurActiveTableCellInput, dismissEditorKeyboardForChrome } from './tableChromeKeyboard'
import { requestNativeTableSheet, closeNativeTableSheets } from './tableNativeSheet'
import {
  copyTableMarkdownFromBlock,
  findCurrentTableRange,
  readTableModelFromBlock,
  writeTextToClipboard,
  writeTextToClipboardSync
} from './tableDom'
import { findTableNodeBounds } from './tableBounds'
import { parseTableFromDoc } from './table.model'
import { setColumnAlignmentMarkdown, sortTableByColumnMarkdown } from './table.ops'
import { readTableAlignmentsFromDoc } from './table.ops'
import { serializeTable } from './table.model'
import { allowTableStructureEdit, forceTableRefresh } from './tableEffects'
import type { ColumnAlignment } from './tableGridModel'
import { applyFixedContextMenuLayout } from '../../../desktop/ContextMenu/context-menu-placement.util'

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}

export type TableMenuItem = {
  id: string
  label: string
  disabled?: boolean
  destructive?: boolean
}

export type TableMenuSection = { items: TableMenuItem[] }

let lastChromeMenuOpenAt = 0
const CHROME_MENU_DEBOUNCE_MS = 280
let lastChromeTouchAt = 0

const CHROME_TOUCH_SELECTOR = '.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn'

const MENU_LAYER_SELECTOR = '.cm-table-context-menu-layer, .cm-table-sheet-layer'

export function isTableChromeTouchTarget(el: Element | null): HTMLElement | null {
  if (!el) return null
  return el.closest(CHROME_TOUCH_SELECTOR) as HTMLElement | null
}

export { blurActiveTableCellInput, dismissEditorKeyboardForChrome } from './tableChromeKeyboard'

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
  if (now - lastChromeMenuOpenAt < debounceMs) {
    logTableChrome('shouldOpenChromeMenu', { allow: false, reason: 'debounce', debounceMs })
    return false
  }
  lastChromeMenuOpenAt = now
  return true
}

function closeAllTableMenus(): void {
  closeNativeTableSheets()
  document.querySelectorAll(MENU_LAYER_SELECTOR).forEach((el) => el.remove())
  lastChromeMenuOpenAt = 0
}

export function buildColMenuSections(table: ParsedTable, colIndex: number): TableMenuSection[] {
  const colCount = table.columnCount
  return [
    {
      items: [
        { id: 'sort-asc', label: '按列排序 (A-Z)' },
        { id: 'sort-desc', label: '按列排序 (Z-A)' }
      ]
    },
    {
      items: [
        { id: 'align-none', label: '取消对齐' },
        { id: 'align-left', label: '左对齐' },
        { id: 'align-center', label: '居中对齐' },
        { id: 'align-right', label: '右对齐' }
      ]
    },
    {
      items: [
        { id: 'duplicate-col', label: '复制列' },
        { id: 'clear-col', label: '清空列' }
      ]
    },
    {
      items: [
        { id: 'insert-col-left', label: '在左侧插入列' },
        { id: 'insert-col-right', label: '在右侧插入列' }
      ]
    },
    {
      items: [
        { id: 'left', label: '向左移动列', disabled: colIndex <= 0 },
        { id: 'right', label: '向右移动列', disabled: colIndex >= colCount - 1 }
      ]
    },
    {
      items: [{ id: 'delete', label: '删除列', disabled: colCount <= 1, destructive: true }]
    }
  ]
}

export function buildRowMenuSections(table: ParsedTable, rowIndex: number): TableMenuSection[] {
  if (rowIndex < 0) {
    return [{ items: [{ id: 'noop', label: '表头行', disabled: true }] }]
  }
  const rowCount = table.bodyRows.length
  return [
    {
      items: [
        { id: 'insert-row-above', label: '在上方插入行' },
        { id: 'insert-row-below', label: '在下方插入行' }
      ]
    },
    {
      items: [
        { id: 'up', label: '向上移动行', disabled: rowIndex <= 0 },
        { id: 'down', label: '向下移动行', disabled: rowIndex >= rowCount - 1 }
      ]
    },
    {
      items: [
        { id: 'duplicate-row', label: '复制行' },
        { id: 'clear-row', label: '清空行' },
        { id: 'copy-row', label: '复制行到剪贴板' }
      ]
    },
    {
      items: [{ id: 'delete', label: '删除行', destructive: true }]
    }
  ]
}

export function buildCellContextMenuSections(
  table: ParsedTable,
  rowIndex: number,
  colIndex: number
): TableMenuSection[] {
  return rowIndex < 0
    ? buildColMenuSections(table, colIndex)
    : buildRowMenuSections(table, rowIndex)
}

export function buildColMenuItems(table: ParsedTable, colIndex: number): TableMenuItem[] {
  return buildColMenuSections(table, colIndex).flatMap((s) => s.items)
}

export function buildRowMenuItems(table: ParsedTable, rowIndex: number): TableMenuItem[] {
  return buildRowMenuSections(table, rowIndex).flatMap((s) => s.items)
}

export function runChromeMenuAction(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  handle: HTMLElement,
  actionId: string
): void {
  const colIndex = Number(handle.dataset.colIndex)
  const rowIndex = Number(handle.dataset.rowIndex)
  if (handle.classList.contains('cm-table-col-handle')) {
    runCellContextMenuAction(view, tableFrom, tableTo, -1, colIndex, actionId)
    return
  }
  if (handle.classList.contains('cm-table-row-handle')) {
    runCellContextMenuAction(view, tableFrom, tableTo, rowIndex, 0, actionId)
  }
}

export function runCellContextMenuAction(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  rowIndex: number,
  colIndex: number,
  actionId: string
): void {
  if (actionId === 'noop') return

  const applyMarkdown = (markdown: string | null) => {
    if (!markdown) return
    const bounds = findTableNodeBounds(view.state, tableFrom)
    const from = bounds?.nodeFrom ?? tableFrom
    const to = bounds?.nodeTo ?? tableTo
    view.dispatch({
      changes: { from, to, insert: markdown },
      annotations: allowTableStructureEdit.of(true),
      effects: forceTableRefresh.of(null)
    })
  }

  if (rowIndex < 0) {
    switch (actionId) {
      case 'sort-asc':
      case 'sort-desc': {
        const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
        if (!table) return
        applyMarkdown(
          sortTableByColumnMarkdown(table, view.state.doc, colIndex, actionId === 'sort-asc')
        )
        return
      }
      case 'align-none':
      case 'align-left':
      case 'align-center':
      case 'align-right': {
        const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
        if (!table) return
        const alignment: ColumnAlignment =
          actionId === 'align-left'
            ? 'left'
            : actionId === 'align-center'
              ? 'center'
              : actionId === 'align-right'
                ? 'right'
                : 'none'
        applyMarkdown(setColumnAlignmentMarkdown(table, view.state.doc, colIndex, alignment))
        return
      }
      case 'duplicate-col': {
        const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
        if (!table) return
        const header = [...table.header.cells]
        const body = table.bodyRows.map((row) => [...row.cells])
        const alignments = readTableAlignmentsFromDoc(table, view.state.doc)
        header.splice(colIndex + 1, 0, header[colIndex] ?? '')
        alignments.splice(colIndex + 1, 0, alignments[colIndex] ?? 'none')
        body.forEach((row) => row.splice(colIndex + 1, 0, row[colIndex] ?? ''))
        applyMarkdown(serializeTable(header, body, alignments, { prettify: true }))
        return
      }
      case 'clear-col': {
        const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
        if (!table) return
        const header = [...table.header.cells]
        const body = table.bodyRows.map((row) => [...row.cells])
        const alignments = readTableAlignmentsFromDoc(table, view.state.doc)
        header[colIndex] = ''
        body.forEach((row) => {
          row[colIndex] = ''
        })
        applyMarkdown(serializeTable(header, body, alignments, { prettify: true }))
        return
      }
      case 'insert-col-left':
        invokeTableAction(view, {
          type: 'addColumn',
          tableFrom,
          tableTo,
          atIndex: colIndex,
          focusAfter: { rowIndex: -1, colIndex }
        })
        return
      case 'insert-col-right':
        invokeTableAction(view, {
          type: 'addColumn',
          tableFrom,
          tableTo,
          atIndex: colIndex + 1,
          focusAfter: { rowIndex: -1, colIndex: colIndex + 1 }
        })
        return
      case 'delete':
        invokeTableAction(view, { type: 'deleteColumn', tableFrom, tableTo, colIndex })
        clearTableChromeSelection(view)
        return
      case 'left':
        invokeTableAction(view, {
          type: 'moveColumn',
          tableFrom,
          tableTo,
          fromIndex: colIndex,
          toIndex: colIndex - 1
        })
        if (colIndex > 0) {
          view.dispatch({
            effects: setTableChromeSelection.of({ tableFrom, kind: 'col', index: colIndex - 1 })
          })
        }
        return
      case 'right':
        invokeTableAction(view, {
          type: 'moveColumn',
          tableFrom,
          tableTo,
          fromIndex: colIndex,
          toIndex: colIndex + 1
        })
        view.dispatch({
          effects: setTableChromeSelection.of({ tableFrom, kind: 'col', index: colIndex + 1 })
        })
        return
    }
    return
  }

  switch (actionId) {
    case 'insert-row-above':
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: rowIndex,
        focusAfter: { rowIndex, colIndex }
      })
      return
    case 'insert-row-below':
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: rowIndex + 1,
        focusAfter: { rowIndex: rowIndex + 1, colIndex }
      })
      return
    case 'duplicate-row': {
      const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
      if (!table || rowIndex < 0 || rowIndex >= table.bodyRows.length) return
      const cells = [...table.bodyRows[rowIndex]!.cells]
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: rowIndex + 1,
        templateRow: cells,
        focusAfter: { rowIndex: rowIndex + 1, colIndex }
      })
      return
    }
    case 'clear-row': {
      const table = parseTableFromDoc(view.state.doc, tableFrom, tableTo)
      if (!table || rowIndex < 0 || rowIndex >= table.bodyRows.length) return
      const header = [...table.header.cells]
      const body = table.bodyRows.map((row) => [...row.cells])
      body[rowIndex] = Array.from({ length: header.length }, () => '')
      const alignments = readTableAlignmentsFromDoc(table, view.state.doc)
      applyMarkdown(serializeTable(header, body, alignments, { prettify: true }))
      return
    }
    case 'copy-row': {
      const block = view.dom.querySelector(
        `.cm-table-block[data-table-from="${tableFrom}"]`
      ) as HTMLElement | null
      const model = block ? readTableModelFromBlock(block) : null
      if (!model || rowIndex < 0 || rowIndex >= model.rows.length) return
      const cells = [...model.rows[rowIndex]!]
      writeTextToClipboardSync(`| ${cells.join(' | ')} |`)
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: rowIndex + 1,
        templateRow: cells,
        focusAfter: { rowIndex: rowIndex + 1, colIndex }
      })
      view.dispatch({
        effects: setTableChromeSelection.of({ tableFrom, kind: 'row', index: rowIndex + 1 })
      })
      return
    }
    case 'delete':
      invokeTableAction(view, { type: 'deleteRow', tableFrom, tableTo, rowIndex })
      clearTableChromeSelection(view)
      return
    case 'up':
      invokeTableAction(view, {
        type: 'moveRow',
        tableFrom,
        tableTo,
        fromIndex: rowIndex,
        toIndex: rowIndex - 1
      })
      if (rowIndex > 0) {
        view.dispatch({
          effects: setTableChromeSelection.of({ tableFrom, kind: 'row', index: rowIndex - 1 })
        })
      }
      return
    case 'down':
      invokeTableAction(view, {
        type: 'moveRow',
        tableFrom,
        tableTo,
        fromIndex: rowIndex,
        toIndex: rowIndex + 1
      })
      view.dispatch({
        effects: setTableChromeSelection.of({ tableFrom, kind: 'row', index: rowIndex + 1 })
      })
      return
  }
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

/** 桌面端：单元格右键菜单（Obsidian / atomic-editor 风格） */
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

function pickMenuItem(
  btn: HTMLButtonElement,
  item: TableMenuItem,
  onPick: (id: string) => void,
  close: () => void
): void {
  let picked = false
  const runPick = async () => {
    if (item.destructive) {
      const confirmed = await requestTableConfirm(confirmMessageForDestructiveItem(item), {
        destructive: true
      })
      if (!confirmed) {
        picked = false
        return
      }
    }
    onPick(item.id)
    close()
  }
  const pick = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    if (picked || item.disabled) return
    picked = true
    void runPick()
  }
  btn.addEventListener('click', pick)
  btn.addEventListener('touchstart', pick, { passive: false })
}

export function showTableContextMenu(
  items: TableMenuItem[],
  clientX: number,
  clientY: number,
  onPick: (id: string) => void
): void {
  showTableMenuPopup(items, clientX, clientY, onPick)
}

function unlockPageOverflowForSheet(): void {
  document.documentElement.style.overflow = 'visible'
  document.body.style.overflow = 'visible'
}

function restorePageOverflowAfterSheet(): void {
  if (document.querySelector(MENU_LAYER_SELECTOR)) return
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

function getVisualViewportBox(): { top: number; left: number; width: number; height: number } {
  const vv = window.visualViewport
  return {
    top: vv?.offsetTop ?? 0,
    left: vv?.offsetLeft ?? 0,
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight
  }
}

/** 菜单贴 WebView 视口最底（不预留 RN 工具栏高度；工具栏在 WebView 外） */
function pinTableSheetToVisualViewport(layer: HTMLElement, sheet: HTMLElement): () => void {
  const apply = () => {
    const box = getVisualViewportBox()
    const layerTop = box.top
    const layerHeight = Math.max(box.height, window.innerHeight - box.top)

    layer.style.position = 'fixed'
    layer.style.top = `${layerTop}px`
    layer.style.left = `${box.left}px`
    layer.style.width = `${box.width}px`
    layer.style.height = `${layerHeight}px`
    layer.style.right = 'auto'
    layer.style.bottom = 'auto'
    layer.style.display = 'flex'
    layer.style.flexDirection = 'column'
    layer.style.justifyContent = 'flex-end'
    layer.style.zIndex = '2147483000'
    layer.style.pointerEvents = 'none'
    layer.style.overflow = 'hidden'

    sheet.style.marginBottom = '0'
    sheet.style.maxHeight = `${Math.max(200, layerHeight * 0.72)}px`
  }

  apply()
  const vv = window.visualViewport
  vv?.addEventListener('resize', apply)
  vv?.addEventListener('scroll', apply)
  window.addEventListener('resize', apply)
  return () => {
    vv?.removeEventListener('resize', apply)
    vv?.removeEventListener('scroll', apply)
    window.removeEventListener('resize', apply)
  }
}

const SHEET_CLOSE_MS = 360

function animateCloseTableSheet(layer: HTMLElement, sheet: HTMLElement, onDone: () => void): void {
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    onDone()
  }

  layer.classList.remove('cm-table-sheet-layer--open')
  layer.classList.add('cm-table-sheet-layer--closing')
  sheet.addEventListener('transitionend', finish, { once: true })
  window.setTimeout(finish, SHEET_CLOSE_MS)
}

export function showTableBottomSheet(
  title: string,
  sections: TableMenuSection[],
  onPick: (id: string) => void,
  onClose?: () => void
): void {
  closeAllTableMenus()
  if (requestNativeTableSheet(title, sections, onPick, onClose)) {
    logTableChrome('showTableBottomSheet:native', {
      title,
      itemCount: sections.reduce((n, s) => n + s.items.length, 0)
    })
    return
  }
  showDomTableBottomSheet(title, sections, onPick, onClose)
}

function showDomTableBottomSheet(
  title: string,
  sections: TableMenuSection[],
  onPick: (id: string) => void,
  onClose?: () => void
): void {
  ensureTableSheetGlobalStyles()
  logTableChrome('showTableBottomSheet:start', {
    title,
    itemCount: sections.reduce((n, s) => n + s.items.length, 0)
  })

  const layer = document.createElement('div')
  layer.className = 'cm-table-sheet-layer'

  const dismissZone = document.createElement('div')
  dismissZone.className = 'cm-table-sheet-dismiss'
  dismissZone.setAttribute('aria-hidden', 'true')

  const sheet = document.createElement('div')
  sheet.className = 'cm-table-sheet'
  sheet.setAttribute('role', 'dialog')
  sheet.setAttribute('aria-label', title)

  const grabber = document.createElement('div')
  grabber.className = 'cm-table-sheet-grabber'
  sheet.appendChild(grabber)

  if (title) {
    const heading = document.createElement('div')
    heading.className = 'cm-table-sheet-title'
    heading.textContent = title
    sheet.appendChild(heading)
  }

  const body = document.createElement('div')
  body.className = 'cm-table-sheet-body'

  let unpinViewport = () => {}

  const finishClose = () => {
    unpinViewport()
    layer.remove()
    restorePageOverflowAfterSheet()
    markTableSheetClosed()
    onClose?.()
  }

  const close = () => {
    if (layer.classList.contains('cm-table-sheet-layer--closing')) return
    dismissKeyboardForSheetInteraction()
    animateCloseTableSheet(layer, sheet, finishClose)
  }

  const openedAt = Date.now()
  const canClose = () => Date.now() - openedAt > 280

  const closeFromDismiss = (e: Event) => {
    if (!canClose()) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()
    dismissKeyboardForSheetInteraction()
    close()
  }

  dismissZone.addEventListener('touchstart', closeFromDismiss, { passive: false })
  dismissZone.addEventListener('click', closeFromDismiss)

  for (const section of sections) {
    const group = document.createElement('div')
    group.className = 'cm-table-sheet-group'
    if (section.items.every((item) => item.destructive)) {
      group.classList.add('cm-table-sheet-group--destructive')
    }
    for (const item of section.items) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'cm-table-sheet-item'
      if (item.destructive) btn.classList.add('cm-table-sheet-item--destructive')
      btn.textContent = item.label
      btn.disabled = Boolean(item.disabled)
      btn.setAttribute('role', 'menuitem')
      pickMenuItem(btn, item, onPick, close)
      group.appendChild(btn)
    }
    body.appendChild(group)
  }

  sheet.appendChild(body)
  layer.appendChild(dismissZone)
  layer.appendChild(sheet)
  unlockPageOverflowForSheet()
  markTableSheetOpen()
  document.body.appendChild(layer)
  unpinViewport = pinTableSheetToVisualViewport(layer, sheet)

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      layer.classList.add('cm-table-sheet-layer--open')
    })
  })

  const box = getVisualViewportBox()
  const rect = sheet.getBoundingClientRect()
  logTableChrome('showTableBottomSheet:mounted', {
    title,
    sheetTop: rect.top,
    sheetBottom: rect.bottom,
    sheetHeight: rect.height,
    viewportH: window.innerHeight,
    visualViewportH: box.height,
    visualViewportTop: box.top,
    inDom: document.body.contains(layer),
    htmlOverflow: document.documentElement.style.overflow,
    bodyOverflow: document.body.style.overflow
  })
}

function showTableMenuPopup(
  items: TableMenuItem[],
  clientX: number,
  clientY: number,
  onPick: (id: string) => void
): void {
  closeAllTableMenus()
  ensureTableContextMenuGlobalStyles()

  const layer = document.createElement('div')
  layer.className = 'cm-table-context-menu-layer'

  const backdrop = document.createElement('div')
  backdrop.className = 'cm-table-context-menu-backdrop'
  backdrop.setAttribute('aria-hidden', 'true')

  const menu = document.createElement('div')
  menu.className = 'cm-table-context-menu'
  menu.setAttribute('role', 'menu')
  menu.style.left = `${clientX}px`
  menu.style.top = `${clientY}px`

  const openedAt = Date.now()
  const close = () => layer.remove()
  const canCloseFromBackdrop = () => Date.now() - openedAt > 360

  const absorbPointer = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const closeFromBackdrop = (e: Event) => {
    if (!canCloseFromBackdrop()) {
      absorbPointer(e)
      return
    }
    absorbPointer(e)
    close()
  }

  backdrop.addEventListener('mousedown', closeFromBackdrop)
  backdrop.addEventListener('click', closeFromBackdrop)
  backdrop.addEventListener('touchend', closeFromBackdrop, { passive: false })

  const stopMenuBubble = (e: Event) => {
    e.stopPropagation()
  }
  menu.addEventListener('mousedown', stopMenuBubble)
  menu.addEventListener('mouseup', stopMenuBubble)
  menu.addEventListener('click', stopMenuBubble)
  menu.addEventListener('touchstart', stopMenuBubble, { passive: true })
  menu.addEventListener('touchend', stopMenuBubble, { passive: true })

  for (const item of items) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-table-context-menu-item'
    if (item.destructive) btn.classList.add('cm-table-context-menu-item--destructive')
    btn.textContent = item.label
    btn.disabled = Boolean(item.disabled)
    btn.setAttribute('role', 'menuitem')
    pickMenuItem(btn, item, onPick, close)
    menu.appendChild(btn)
  }

  layer.appendChild(backdrop)
  layer.appendChild(menu)
  document.body.appendChild(layer)

  requestAnimationFrame(() => {
    applyFixedContextMenuLayout(menu, clientX, clientY)
  })
}

function isTouchTableBlock(trigger: HTMLElement): boolean {
  return Boolean(trigger.closest('.cm-table-block--touch'))
}

function isRowOrColHandle(trigger: HTMLElement): boolean {
  return (
    trigger.classList.contains('cm-table-row-handle') ||
    trigger.classList.contains('cm-table-col-handle')
  )
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
          { id: 'copy-table', label: '复制表格' },
          { id: 'delete-table', label: '删除表格', destructive: true }
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
      showTableBottomSheet('表格', sections, onPick)
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
    const title = rowIndex < 0 ? '表头' : `第 ${rowIndex + 1} 行`
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
