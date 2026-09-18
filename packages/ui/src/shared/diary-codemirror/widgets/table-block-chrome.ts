import i18n from 'i18next'
import {
  buildColMenuItems,
  buildColMenuSections,
  buildRowMenuItems,
  buildRowMenuSections,
  runCellContextMenuAction,
  showTableBottomSheet,
  showTableContextMenu,
  type TableMenuItem
} from '../table/tableContextMenu'
import { findCurrentTableRange, copyTableMarkdownFromBlock } from '../table/tableDom'
import { createTableGripIcon, createTableGridIcon } from './tableChromeIcons'
import {
  commitFocusedCell,
  runTableBlockAction,
  type TableBlockWidgetContext
} from './table-block-widget-context'

type MenuItem = TableMenuItem

/**
 * 角标、行列把手、添加按钮与菜单。
 * 这些 chrome 会改表格结构，必须和单元格编辑 DOM 分开，避免把手拖拽与格内输入互相改同一段代码。
 */
export function createAddBtn(ctx: TableBlockWidgetContext, kind: 'row' | 'col'): HTMLElement {
  const isTouch = ctx.platform?.interactionMode === 'touch'
  const btn = createChromeTrigger(isTouch ? 'div' : 'button')
  btn.className = `cm-table-add-btn cm-table-add-${kind}`
  btn.setAttribute(
    'aria-label',
    kind === 'row'
      ? i18n.t(
          'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L200',
          '添加行'
        )
      : i18n.t(
          'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L200',
          '添加列'
        )
  )
  const icon = document.createElement('span')
  icon.className = 'cm-table-add-btn-icon'
  icon.textContent = '+'
  btn.appendChild(icon)

  const run = () => {
    runTableBlockAction(ctx, {
      type: kind === 'row' ? 'addRow' : 'addColumn',
      tableFrom: ctx.table.from,
      tableTo: ctx.table.to
    })
  }

  if (!isTouch) {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      run()
    })
  }
  return btn
}

export function createCorner(ctx: TableBlockWidgetContext): HTMLElement {
  const isTouch = ctx.platform?.interactionMode === 'touch'
  const btn = createChromeTrigger(isTouch ? 'div' : 'button')
  btn.className = 'cm-table-chrome-corner cm-table-corner-menu'
  if (ctx.platform?.interactionMode === 'touch') {
    btn.classList.add('cm-table-handle--touch')
  }
  btn.setAttribute(
    'aria-label',
    i18n.t('auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L767', '表格菜单')
  )
  btn.appendChild(createTableGridIcon(3, 3))
  bindTableMenu(ctx, btn)
  return btn
}

/** 高亮当前行列把手：chrome 选中优先于活动格，避免框选和单击抢同一套 class。 */
export function syncActiveHandles(
  ctx: TableBlockWidgetContext,
  rowIndex?: number,
  colIndex?: number
): void {
  const root = ctx.getRootEl()
  if (!root) return
  const activeRow =
    ctx.chromeSelection?.kind === 'row'
      ? ctx.chromeSelection.index
      : (rowIndex ?? ctx.activeCell?.rowIndex)
  const activeCol =
    ctx.chromeSelection?.kind === 'col'
      ? ctx.chromeSelection.index
      : (colIndex ?? ctx.activeCell?.colIndex)
  if (activeRow == null && activeCol == null) return

  root.classList.add('cm-table-block--has-active-cell')
  root.querySelectorAll('.cm-table-col-handle').forEach((handle) => {
    const handleCol = Number((handle as HTMLElement).dataset.colIndex)
    handle.classList.toggle('cm-table-handle--active', activeCol != null && handleCol === activeCol)
  })
  root.querySelectorAll('.cm-table-row-handle').forEach((handle) => {
    const handleRow = Number((handle as HTMLElement).dataset.rowIndex)
    handle.classList.toggle('cm-table-handle--active', activeRow != null && handleRow === activeRow)
  })
}

function bindTableMenu(ctx: TableBlockWidgetContext, btn: HTMLElement): void {
  const open = () => {
    const rect = btn.getBoundingClientRect()
    showMenu(
      ctx,
      [
        {
          id: 'copy-table',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L1076',
            '复制表格'
          )
        },
        {
          id: 'delete-table',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L1077',
            '删除表格'
          ),
          destructive: true
        }
      ],
      rect.left,
      rect.bottom + 4,
      (id) => {
        if (id === 'copy-table') {
          void copyTableMarkdown(ctx)
          return
        }
        if (id !== 'delete-table') return
        runTableBlockAction(ctx, {
          type: 'deleteTable',
          tableFrom: ctx.table.from,
          tableTo: ctx.table.to
        })
      }
    )
  }

  bindMenuTrigger(ctx, btn, open)
}

async function copyTableMarkdown(ctx: TableBlockWidgetContext): Promise<void> {
  commitFocusedCell(ctx)
  const view = ctx.editorView()
  const root = ctx.getRootEl()
  if (!view || !root) return
  await copyTableMarkdownFromBlock(view, root)
}

/**
 * 鼠标端触发（click / contextmenu）。触摸端一律走 installTouchDelegation。
 */
function bindMenuTrigger(
  ctx: TableBlockWidgetContext,
  btn: HTMLElement,
  open: (e?: Event) => void
): void {
  if (ctx.platform?.interactionMode === 'touch') return
  const runOpen = (e?: Event) => {
    commitFocusedCell(ctx)
    open(e)
  }
  btn.addEventListener('click', (e) => runOpen(e))
  btn.addEventListener('contextmenu', (e) => runOpen(e))
}

function bindHandleMenuClick(
  ctx: TableBlockWidgetContext,
  btn: HTMLElement,
  openMenu: (clientX: number, clientY: number) => void
): void {
  let dragged = false
  btn.addEventListener('dragstart', () => {
    dragged = true
  })
  btn.addEventListener('dragend', () => {
    requestAnimationFrame(() => {
      dragged = false
    })
  })

  const openFromButton = (e?: Event) => {
    if (dragged) return
    e?.preventDefault()
    e?.stopPropagation()
    const rect = btn.getBoundingClientRect()
    openMenu(rect.left, rect.bottom + 4)
  }

  bindMenuTrigger(ctx, btn, openFromButton)
}

function createChromeTrigger(tagName: 'button' | 'div'): HTMLElement {
  if (tagName === 'button') {
    const btn = document.createElement('button')
    btn.type = 'button'
    return btn
  }
  const el = document.createElement('div')
  el.setAttribute('role', 'button')
  el.tabIndex = -1
  return el
}

export function createColHandle(ctx: TableBlockWidgetContext, colIndex: number): HTMLElement {
  const isTouch = ctx.platform?.interactionMode === 'touch'
  const btn = createChromeTrigger(isTouch ? 'div' : 'button')
  btn.className = 'cm-table-handle cm-table-col-handle'
  if (ctx.platform?.interactionMode === 'touch') {
    btn.classList.add('cm-table-handle--touch')
  }
  btn.setAttribute('aria-label', `列 ${colIndex + 1}`)
  btn.appendChild(createTableGripIcon())
  btn.dataset.colIndex = String(colIndex)

  bindHandleMenu(
    ctx,
    btn,
    () => colMenuItems(ctx, colIndex),
    (from, to) => {
      runTableBlockAction(ctx, {
        type: 'moveColumn',
        tableFrom: ctx.table.from,
        tableTo: ctx.table.to,
        fromIndex: from,
        toIndex: to
      })
    }
  )
  return btn
}

export function createRowHandle(
  ctx: TableBlockWidgetContext,
  rowIndex: number,
  label: string
): HTMLElement {
  const isTouch = ctx.platform?.interactionMode === 'touch'
  const btn = createChromeTrigger(isTouch ? 'div' : 'button')
  btn.className = 'cm-table-handle cm-table-row-handle'
  if (ctx.platform?.interactionMode === 'touch') {
    btn.classList.add('cm-table-handle--touch')
  }
  btn.setAttribute('aria-label', label)
  btn.appendChild(createTableGripIcon())
  btn.dataset.rowIndex = String(rowIndex)

  if (rowIndex < 0) {
    btn.classList.add('cm-table-row-handle--header')
  }

  bindHandleMenu(
    ctx,
    btn,
    () => rowMenuItems(ctx, rowIndex),
    (from, to) => {
      runTableBlockAction(ctx, {
        type: 'moveRow',
        tableFrom: ctx.table.from,
        tableTo: ctx.table.to,
        fromIndex: from,
        toIndex: to
      })
    }
  )
  return btn
}

function bindHandleMenu(
  ctx: TableBlockWidgetContext,
  btn: HTMLElement,
  _items: () => MenuItem[],
  onReorder?: (fromIndex: number, toIndex: number) => void
): void {
  const kind = btn.classList.contains('cm-table-col-handle') ? 'col' : 'row'
  const index = Number(btn.dataset.colIndex ?? btn.dataset.rowIndex)
  const handleSelector = kind === 'col' ? '.cm-table-col-handle' : '.cm-table-row-handle'
  const dataKey = kind === 'col' ? 'colIndex' : 'rowIndex'

  const openMenu = (clientX: number, clientY: number) => {
    const colIndex = Number(btn.dataset.colIndex)
    const rowIndex = Number(btn.dataset.rowIndex)
    const isCol = kind === 'col'
    const sections = isCol
      ? buildColMenuSections(ctx.table, colIndex)
      : buildRowMenuSections(ctx.table, rowIndex)
    const title = isCol
      ? `第 ${colIndex + 1} 列`
      : rowIndex < 0
        ? i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L1236',
            '表头'
          )
        : `第 ${rowIndex + 1} 行`
    showMenu(
      ctx,
      sections.flatMap((s) => s.items),
      clientX,
      clientY,
      (id) => runMenuAction(ctx, btn, id),
      { title, sections }
    )
  }

  bindHandleMenuClick(ctx, btn, openMenu)

  if (!onReorder || Number.isNaN(index) || index < 0) {
    return
  }

  if (ctx.platform?.interactionMode === 'touch') {
    btn.draggable = false
    return
  }

  btn.draggable = true
  btn.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData('text/plain', `${kind}:${index}`)
    e.dataTransfer!.effectAllowed = 'move'
    btn.classList.add('cm-table-handle--dragging')
  })
  btn.addEventListener('dragend', () => {
    btn.classList.remove('cm-table-handle--dragging')
    clearDropHighlight(ctx, handleSelector)
  })
  btn.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    highlightDropTarget(ctx, e.target as HTMLElement, handleSelector)
  })
  btn.addEventListener('dragleave', () => {
    btn.classList.remove('cm-table-handle--drop-target')
  })
  btn.addEventListener('drop', (e) => {
    e.preventDefault()
    btn.classList.remove('cm-table-handle--dragging', 'cm-table-handle--drop-target')
    clearDropHighlight(ctx, handleSelector)
    const raw = e.dataTransfer?.getData('text/plain') ?? ''
    const fromIndex = Number(raw.split(':')[1])
    const target = (e.target as HTMLElement).closest(handleSelector) as HTMLElement | null
    const toIndex = Number(target?.dataset[dataKey])
    if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) return
    onReorder(fromIndex, toIndex)
  })
}

function highlightDropTarget(
  ctx: TableBlockWidgetContext,
  target: HTMLElement | null,
  selector: string
): void {
  clearDropHighlight(ctx, selector)
  const handle = target?.closest(selector) as HTMLElement | null
  handle?.classList.add('cm-table-handle--drop-target')
}

function clearDropHighlight(ctx: TableBlockWidgetContext, selector: string): void {
  ctx
    .getRootEl()
    ?.querySelectorAll(selector)
    .forEach((el) => {
      el.classList.remove('cm-table-handle--drop-target')
    })
}

function colMenuItems(ctx: TableBlockWidgetContext, colIndex: number): MenuItem[] {
  return buildColMenuItems(ctx.table, colIndex)
}

function rowMenuItems(ctx: TableBlockWidgetContext, rowIndex: number): MenuItem[] {
  return buildRowMenuItems(ctx.table, rowIndex)
}

function runMenuAction(ctx: TableBlockWidgetContext, handle: HTMLElement, actionId: string): void {
  if (actionId === 'noop') return
  commitFocusedCell(ctx)

  const view = ctx.editorView()
  const root = ctx.getRootEl()
  if (!view || !root) return
  const range = findCurrentTableRange(view, root)
  if (!range) return

  const colIndex = Number(handle.dataset.colIndex)
  const rowIndex = Number(handle.dataset.rowIndex)

  if (handle.classList.contains('cm-table-col-handle')) {
    runCellContextMenuAction(view, range.from, range.to, -1, colIndex, actionId)
    return
  }
  if (handle.classList.contains('cm-table-row-handle')) {
    runCellContextMenuAction(view, range.from, range.to, rowIndex, 0, actionId)
  }
}

export function showMenu(
  ctx: TableBlockWidgetContext,
  items: MenuItem[],
  clientX: number,
  clientY: number,
  onPick: (id: string) => void,
  options?: { title?: string; sections?: { items: MenuItem[] }[] }
): void {
  if (ctx.platform?.interactionMode === 'touch') {
    const sections = options?.sections ?? [{ items }]
    showTableBottomSheet(
      options?.title ??
        i18n.t(
          'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L1411',
          '表格'
        ),
      sections,
      onPick
    )
    return
  }
  showTableContextMenu(items, clientX, clientY, onPick)
}
