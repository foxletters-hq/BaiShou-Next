import { WidgetType, EditorView } from '@codemirror/view'
import type { ParsedTable } from '../table/table.model'
import { invokeTableAction } from '../table/tableEffects'
import type { DiaryCmPlatform } from '../types'

const LONG_PRESS_MS = 420
const TOUCH_DRAG_THRESHOLD_PX = 20

let suppressTableCellBlurSync = false

type MenuItem = { id: string; label: string; disabled?: boolean }

export class TableBlockWidget extends WidgetType {
  private rootEl: HTMLElement | null = null

  constructor(
    private readonly table: ParsedTable,
    private readonly platform?: DiaryCmPlatform
  ) {
    super()
  }

  eq(other: TableBlockWidget): boolean {
    const cellsKey = (t: ParsedTable) =>
      [t.header.cells.join('\0'), ...t.bodyRows.map((r) => r.cells.join('\0'))].join('\n')
    return (
      this.table.from === other.table.from &&
      this.table.to === other.table.to &&
      cellsKey(this.table) === cellsKey(other.table)
    )
  }

  toDOM(): HTMLElement {
    const root = document.createElement('div')
    this.rootEl = root
    root.className = 'cm-table-block'
    root.dataset.tableFrom = String(this.table.from)
    root.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement
      if (target.closest('.cm-table-cell-editable, button, .cm-table-context-menu')) return
      e.preventDefault()
    })

    const topBar = document.createElement('div')
    topBar.className = 'cm-table-chrome-top'
    topBar.appendChild(this.createCorner())
    const colHandles = document.createElement('div')
    colHandles.className = 'cm-table-col-handles'
    this.table.header.cells.forEach((_, colIndex) => {
      colHandles.appendChild(this.createColHandle(colIndex))
    })
    topBar.appendChild(colHandles)
    root.appendChild(topBar)

    const bodyWrap = document.createElement('div')
    bodyWrap.className = 'cm-table-chrome-body'

    const rowHandles = document.createElement('div')
    rowHandles.className = 'cm-table-row-handles'
    rowHandles.appendChild(this.createRowHandle(-1, '表头'))
    this.table.bodyRows.forEach((_, rowIndex) => {
      rowHandles.appendChild(this.createRowHandle(rowIndex, `第 ${rowIndex + 1} 行`))
    })
    bodyWrap.appendChild(rowHandles)

    const tableEl = document.createElement('table')
    tableEl.className = 'cm-table-preview'
    const thead = document.createElement('thead')
    const headTr = document.createElement('tr')
    this.table.header.cells.forEach((cell, colIndex) => {
      headTr.appendChild(this.createEditableCell(cell, -1, colIndex, true, tableEl))
    })
    thead.appendChild(headTr)
    tableEl.appendChild(thead)

    const tbody = document.createElement('tbody')
    this.table.bodyRows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr')
      row.cells.forEach((cell, colIndex) => {
        tr.appendChild(this.createEditableCell(cell, rowIndex, colIndex, false, tableEl))
      })
      tbody.appendChild(tr)
    })
    tableEl.appendChild(tbody)
    const tableShell = document.createElement('div')
    tableShell.className = 'cm-table-grid-shell'
    tableShell.appendChild(tableEl)

    const tableColumn = document.createElement('div')
    tableColumn.className = 'cm-table-main-column'
    tableColumn.appendChild(tableShell)

    const addRowBtn = document.createElement('button')
    addRowBtn.type = 'button'
    addRowBtn.className = 'cm-table-add-btn cm-table-add-row'
    addRowBtn.setAttribute('aria-label', '添加行')
    addRowBtn.textContent = '+'
    addRowBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.runAction({ type: 'addRow', tableFrom: this.table.from, tableTo: this.table.to })
    })
    tableColumn.appendChild(addRowBtn)

    bodyWrap.appendChild(tableColumn)

    const addColBtn = document.createElement('button')
    addColBtn.type = 'button'
    addColBtn.className = 'cm-table-add-btn cm-table-add-col'
    addColBtn.setAttribute('aria-label', '添加列')
    addColBtn.textContent = '+'
    addColBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.runAction({ type: 'addColumn', tableFrom: this.table.from, tableTo: this.table.to })
    })
    bodyWrap.appendChild(addColBtn)
    root.appendChild(bodyWrap)

    requestAnimationFrame(() => {
      this.syncChromeLayout()
      this.observeChromeLayout()
    })

    return root
  }

  private chromeLayoutObserver: ResizeObserver | null = null

  private observeChromeLayout(): void {
    const shell = this.rootEl?.querySelector('.cm-table-grid-shell')
    if (!shell || typeof ResizeObserver === 'undefined') return
    this.chromeLayoutObserver?.disconnect()
    this.chromeLayoutObserver = new ResizeObserver(() => this.syncChromeLayout())
    this.chromeLayoutObserver.observe(shell)
  }

  /** 把手尺寸与表格真实行列像素对齐 */
  private syncChromeLayout(): void {
    const root = this.rootEl
    if (!root) return

    const table = root.querySelector('.cm-table-preview')
    if (!table) return

    const rows = table.querySelectorAll('tr')
    const rowHandles = root.querySelectorAll('.cm-table-row-handle')
    rows.forEach((row, index) => {
      const handle = rowHandles[index] as HTMLElement | undefined
      if (!handle) return
      const height = (row as HTMLElement).getBoundingClientRect().height
      handle.style.height = `${height}px`
      handle.style.flex = '0 0 auto'
      handle.style.margin = '0'
    })

    const headerCells = table.querySelectorAll('thead th')
    const colHandles = root.querySelectorAll('.cm-table-col-handle')
    headerCells.forEach((cell, index) => {
      const handle = colHandles[index] as HTMLElement | undefined
      if (!handle) return
      const width = (cell as HTMLElement).getBoundingClientRect().width
      handle.style.width = `${width}px`
      handle.style.flex = '0 0 auto'
      handle.style.margin = '0'
    })
  }

  ignoreEvent(event: Event): boolean {
    if (!this.rootEl) return false
    const target = event.target
    if (!(target instanceof Node)) return false
    return this.rootEl.contains(target)
  }

  private createCorner(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-table-chrome-corner'
    return el
  }

  private createEditableCell(
    raw: string,
    rowIndex: number,
    colIndex: number,
    isHeader: boolean,
    tableEl: HTMLElement
  ): HTMLElement {
    const el = document.createElement(isHeader ? 'th' : 'td')
    el.className = 'cm-table-cell-editable'
    el.contentEditable = 'true'
    el.spellcheck = false
    el.dataset.row = String(rowIndex)
    el.dataset.col = String(colIndex)
    el.dataset.tableFrom = String(this.table.from)
    this.writeCellContent(el, raw)

    const syncIfChanged = () => this.syncCellFromElement(el, rowIndex, colIndex)

    const goNextCell = () => this.navigateToNextCell(el, tableEl, rowIndex, colIndex)

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        goNextCell()
      }
    })

    el.addEventListener('beforeinput', (e) => {
      const inputType = (e as InputEvent).inputType
      if (inputType === 'insertLineBreak' || inputType === 'insertParagraph') {
        e.preventDefault()
        e.stopPropagation()
        goNextCell()
      }
    })

    el.addEventListener('paste', (e) => {
      e.preventDefault()
      const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/[\r\n]+/g, ' ')
      document.execCommand('insertText', false, text)
    })

    el.addEventListener('input', () => {
      const text = el.innerText
      if (!/[\r\n]/.test(text)) return
      const flat = text.replace(/[\r\n]+/g, ' ')
      el.textContent = flat
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(el)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    })

    el.addEventListener('blur', () => {
      if (suppressTableCellBlurSync) return
      syncIfChanged()
    })

    return el
  }

  private syncCellFromElement(el: HTMLElement, rowIndex: number, colIndex: number): void {
    const value = this.readCellContent(el)
    const current = this.normalizeCellRaw(this.getCellRaw(rowIndex, colIndex))
    if (value === current) return
    this.runAction({
      type: 'updateCell',
      tableFrom: this.table.from,
      tableTo: this.table.to,
      rowIndex,
      colIndex,
      value
    })
  }

  private getCellRaw(rowIndex: number, colIndex: number): string {
    if (rowIndex < 0) return this.table.header.cells[colIndex] ?? ''
    return this.table.bodyRows[rowIndex]?.cells[colIndex] ?? ''
  }

  private normalizeCellRaw(raw: string): string {
    return raw
      .split(/<br\s*\/?>/gi)
      .map((p) => p.trim())
      .filter(Boolean)
      .join(' ')
  }

  private getNextCellCoords(
    rowIndex: number,
    colIndex: number
  ): { rowIndex: number; colIndex: number } {
    const colCount = this.table.columnCount
    const rowCount = this.table.bodyRows.length

    let nextRow = rowIndex
    let nextCol = colIndex + 1

    if (nextCol >= colCount) {
      nextCol = 0
      nextRow += 1
    }

    if (nextRow >= rowCount) {
      nextRow = -1
      nextCol = 0
    } else if (nextRow < -1) {
      nextRow = -1
      nextCol = 0
    }

    return { rowIndex: nextRow, colIndex: nextCol }
  }

  private navigateToNextCell(
    el: HTMLElement,
    tableEl: HTMLElement,
    rowIndex: number,
    colIndex: number
  ): void {
    const value = this.readCellContent(el)
    const current = this.normalizeCellRaw(this.getCellRaw(rowIndex, colIndex))
    const focusAfter = this.getNextCellCoords(rowIndex, colIndex)

    suppressTableCellBlurSync = true
    if (value !== current) {
      this.runAction({
        type: 'updateCell',
        tableFrom: this.table.from,
        tableTo: this.table.to,
        rowIndex,
        colIndex,
        value,
        focusAfter
      })
    } else {
      this.focusCellElement(tableEl, focusAfter.rowIndex, focusAfter.colIndex)
      requestAnimationFrame(() => {
        suppressTableCellBlurSync = false
      })
      return
    }
    requestAnimationFrame(() => {
      suppressTableCellBlurSync = false
    })
  }

  private focusCellElement(tableEl: HTMLElement, rowIndex: number, colIndex: number): void {
    const next = tableEl.querySelector(
      `[data-row="${rowIndex}"][data-col="${colIndex}"]`
    ) as HTMLElement | null
    if (!next) return
    next.focus()
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(next)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  private readCellContent(el: HTMLElement): string {
    return el.innerText.replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, ' ').trim()
  }

  private writeCellContent(el: HTMLElement, raw: string): void {
    el.textContent = this.normalizeCellRaw(raw)
  }

  private createColHandle(colIndex: number): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-table-handle cm-table-col-handle'
    btn.setAttribute('aria-label', `列 ${colIndex + 1}`)
    btn.textContent = '⋮⋮'
    btn.dataset.colIndex = String(colIndex)

    this.bindHandleMenu(btn, () => this.colMenuItems(colIndex), (from, to) => {
      this.runAction({
        type: 'moveColumn',
        tableFrom: this.table.from,
        tableTo: this.table.to,
        fromIndex: from,
        toIndex: to
      })
    })
    return btn
  }

  private createRowHandle(rowIndex: number, label: string): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-table-handle cm-table-row-handle'
    btn.setAttribute('aria-label', label)
    btn.textContent = '⋮⋮'

    if (rowIndex >= 0) {
      btn.dataset.rowIndex = String(rowIndex)
    } else {
      btn.classList.add('cm-table-row-handle--header')
    }

    this.bindHandleMenu(btn, () => this.rowMenuItems(rowIndex), (from, to) => {
      this.runAction({
        type: 'moveRow',
        tableFrom: this.table.from,
        tableTo: this.table.to,
        fromIndex: from,
        toIndex: to
      })
    })
    return btn
  }

  /** 桌面端：拖拽排序 + 右键菜单；移动端：仅长按出菜单 */
  private bindHandleMenu(
    btn: HTMLElement,
    items: () => MenuItem[],
    onReorder?: (fromIndex: number, toIndex: number) => void
  ): void {
    const isTouch = this.platform?.interactionMode === 'touch'
    const kind = btn.classList.contains('cm-table-col-handle') ? 'col' : 'row'
    const index = Number(btn.dataset.colIndex ?? btn.dataset.rowIndex)
    const handleSelector = kind === 'col' ? '.cm-table-col-handle' : '.cm-table-row-handle'
    const dataKey = kind === 'col' ? 'colIndex' : 'rowIndex'

    const openMenu = (clientX: number, clientY: number) => {
      this.showMenu(items(), clientX, clientY, (id) => {
        this.runMenuAction(btn, id)
      })
    }

    if (isTouch) {
      btn.draggable = false
      btn.classList.add('cm-table-handle--touch')
      let pressTime = 0
      let startX = 0
      let startY = 0
      let moved = false
      let menuOpened = false

      const openMenuFromHandle = () => {
        menuOpened = true
        const rect = btn.getBoundingClientRect()
        openMenu(rect.left, rect.bottom + 4)
      }

      const onPressStart = (clientX: number, clientY: number) => {
        menuOpened = false
        pressTime = Date.now()
        startX = clientX
        startY = clientY
        moved = false
      }

      const onPressMove = (clientX: number, clientY: number) => {
        const dx = Math.abs(clientX - startX)
        const dy = Math.abs(clientY - startY)
        if (dx > TOUCH_DRAG_THRESHOLD_PX || dy > TOUCH_DRAG_THRESHOLD_PX) {
          moved = true
        }
      }

      const onPressEnd = () => {
        if (!moved && pressTime > 0 && Date.now() - pressTime >= LONG_PRESS_MS) {
          openMenuFromHandle()
        }
        pressTime = 0
        moved = false
      }

      btn.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length !== 1) return
          const touch = e.touches[0]
          if (!touch) return
          onPressStart(touch.clientX, touch.clientY)
        },
        { passive: true }
      )

      btn.addEventListener(
        'touchmove',
        (e) => {
          if (e.touches.length !== 1) return
          const touch = e.touches[0]
          if (!touch) return
          onPressMove(touch.clientX, touch.clientY)
        },
        { passive: true }
      )

      btn.addEventListener('touchend', onPressEnd, { passive: true })
      btn.addEventListener('touchcancel', onPressEnd, { passive: true })

      btn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return
        onPressStart(e.clientX, e.clientY)
      })
      btn.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse' || pressTime === 0) return
        onPressMove(e.clientX, e.clientY)
      })
      btn.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'mouse') return
        onPressEnd()
      })
      btn.addEventListener('pointercancel', (e) => {
        if (e.pointerType === 'mouse') return
        onPressEnd()
      })

      btn.addEventListener('click', (e) => {
        if (menuOpened) {
          e.preventDefault()
          e.stopPropagation()
          menuOpened = false
        }
      })
      return
    }

    if (!onReorder || Number.isNaN(index) || index < 0) {
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        openMenu(e.clientX, e.clientY)
      })
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
      this.clearDropHighlight(handleSelector)
    })
    btn.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'move'
      this.highlightDropTarget(e.target as HTMLElement, handleSelector)
    })
    btn.addEventListener('dragleave', () => {
      btn.classList.remove('cm-table-handle--drop-target')
    })
    btn.addEventListener('drop', (e) => {
      e.preventDefault()
      btn.classList.remove('cm-table-handle--dragging', 'cm-table-handle--drop-target')
      this.clearDropHighlight(handleSelector)
      const raw = e.dataTransfer?.getData('text/plain') ?? ''
      const fromIndex = Number(raw.split(':')[1])
      const target = (e.target as HTMLElement).closest(handleSelector) as HTMLElement | null
      const toIndex = Number(target?.dataset[dataKey])
      if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) return
      onReorder(fromIndex, toIndex)
    })
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      openMenu(e.clientX, e.clientY)
    })
  }

  private highlightDropTarget(target: HTMLElement | null, selector: string): void {
    this.clearDropHighlight(selector)
    const handle = target?.closest(selector) as HTMLElement | null
    handle?.classList.add('cm-table-handle--drop-target')
  }

  private clearDropHighlight(selector: string): void {
    this.rootEl?.querySelectorAll(selector).forEach((el) => {
      el.classList.remove('cm-table-handle--drop-target')
    })
  }

  private colMenuItems(colIndex: number): MenuItem[] {
    const colCount = this.table.columnCount
    return [
      { id: 'left', label: '左移', disabled: colIndex <= 0 },
      { id: 'right', label: '右移', disabled: colIndex >= colCount - 1 },
      { id: 'delete', label: '删除列', disabled: colCount <= 1 }
    ]
  }

  private rowMenuItems(rowIndex: number): MenuItem[] {
    if (rowIndex < 0) {
      return [{ id: 'noop', label: '表头不可删除', disabled: true }]
    }
    const rowCount = this.table.bodyRows.length
    return [
      { id: 'up', label: '上移', disabled: rowIndex <= 0 },
      { id: 'down', label: '下移', disabled: rowIndex >= rowCount - 1 },
      { id: 'delete', label: '删除行' }
    ]
  }

  private runAction(
    action: Parameters<typeof invokeTableAction>[1]
  ): void {
    const view = this.editorView()
    if (!view) return
    invokeTableAction(view, action)
  }

  private runMenuAction(handle: HTMLElement, actionId: string): void {
    if (actionId === 'noop') return

    const colIndex = Number(handle.dataset.colIndex)
    const rowIndex = Number(handle.dataset.rowIndex)

    if (!Number.isNaN(colIndex)) {
      if (actionId === 'delete') {
        this.runAction({
          type: 'deleteColumn',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          colIndex
        })
      } else if (actionId === 'left') {
        this.runAction({
          type: 'moveColumn',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: colIndex,
          toIndex: colIndex - 1
        })
      } else if (actionId === 'right') {
        this.runAction({
          type: 'moveColumn',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: colIndex,
          toIndex: colIndex + 1
        })
      }
      return
    }

    if (!Number.isNaN(rowIndex)) {
      if (actionId === 'delete') {
        this.runAction({
          type: 'deleteRow',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          rowIndex
        })
      } else if (actionId === 'up') {
        this.runAction({
          type: 'moveRow',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: rowIndex,
          toIndex: rowIndex - 1
        })
      } else if (actionId === 'down') {
        this.runAction({
          type: 'moveRow',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: rowIndex,
          toIndex: rowIndex + 1
        })
      }
    }
  }

  private showMenu(
    items: MenuItem[],
    clientX: number,
    clientY: number,
    onPick: (id: string) => void
  ): void {
    document.querySelector('.cm-table-context-menu-layer')?.remove()

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
      btn.textContent = item.label
      btn.disabled = Boolean(item.disabled)
      btn.setAttribute('role', 'menuitem')

      let picked = false
      const pick = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        if (picked) return
        picked = true
        if (!item.disabled) onPick(item.id)
        close()
      }

      btn.addEventListener('click', pick)
      btn.addEventListener('touchend', pick, { passive: false })
      menu.appendChild(btn)
    }

    layer.appendChild(backdrop)
    layer.appendChild(menu)

    const mount = this.editorView()?.dom ?? document.body
    mount.appendChild(layer)

    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect()
      const pad = 8
      let x = clientX
      let y = clientY
      if (x + rect.width > window.innerWidth - pad) {
        x = Math.max(pad, window.innerWidth - rect.width - pad)
      }
      if (y + rect.height > window.innerHeight - pad) {
        y = Math.max(pad, window.innerHeight - rect.height - pad)
      }
      menu.style.left = `${x}px`
      menu.style.top = `${y}px`
    })
  }

  private editorView(): EditorView | null {
    return this.rootEl ? EditorView.findFromDOM(this.rootEl) : null
  }
}
