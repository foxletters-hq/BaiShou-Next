import type { EditorView } from '@codemirror/view'
import { parseTableFromDoc } from '../table.model'
import { isTableTypeToEditKey } from '../tableInputKeys'
import { findCurrentTableRange } from '../tableDom'
import { blurTableCellEditor, isTableCellEditorFocused } from '../tableDom'
import { readClipboardTextForTablePaste } from '../tableRangeClipboard'
import { pendingTableCellFocus } from '../tableEffects'
import { showTableContextMenu } from '../tableContextMenu'
import { DesktopOutlineSession } from './actions/desktopOutlineSession'
import { matchDesktopNavigateKey, runDesktopNavigate } from './actions/desktopNavigateActions'
import type { CellLocation } from './models/cellLocation'
import { cellEquals } from './models/cellLocation'
import { domRowToParsedRow, parsedRowToDomRow } from './models/cellLocation'
import { DesktopTableSection } from './models/desktopTableSection'
import { cellAtPoint } from './cellAtPoint'
import { commitDesktopTableToDoc } from './tableDescription'
import {
  applyDesktopOutlineHighlight,
  commitDesktopCellEditors,
  dispatchDesktopInteraction,
  isDesktopCellEditorFocused
} from './sync/desktopTableSync'
import { readDesktopTableInteraction, setDesktopTableInteraction } from './tableInteractionField'
import { runDesktopTablePaste } from './desktopTablePaste'
import {
  desktopClearTableRange,
  desktopCopyTableRange,
  domSectionToParsedBounds
} from './desktopRangeClipboard'
import { readTableGridFromDesktopBlock } from './readDesktopGrid'
import { tryDeleteEmptyTableStructure } from './desktopStructureDelete'
import { findTableToByFrom } from '../tableBounds'
import { placeCursorAfterTable } from '../tableFocus'

const CHROME_SELECTOR =
  '.cm-tbl-handle, .cm-tbl-table-handle, .cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn, .cm-table-context-menu-layer, .cm-table-context-menu'

function isCellInnerTarget(target: Element): boolean {
  return Boolean(target.closest('.cm-table-cell-inner, .cm-table-cell-view, .cm-table-cell-editor'))
}

/** ckant 对齐：pointer 框选 + 点击进编辑 + 键盘导航 */
export function installDesktopWidgetInteraction(
  root: HTMLElement,
  tableFrom: number,
  editorView: () => EditorView | null
): () => void {
  root.tabIndex = -1
  const tableEl = root.querySelector('.cm-table-preview') as HTMLTableElement | null
  const scrollHost = root.querySelector('.cm-tbl-scroll, .cm-table-scroll-host') as HTMLElement | null
  let liveSection: DesktopTableSection | null = null
  let outlineAnchor: CellLocation | null = null

  const resolveBlock = (): HTMLElement | null => {
    const view = editorView()
    if (!view) return root.isConnected ? root : null
    return view.dom.querySelector(
      `.cm-table-block[data-table-from="${tableFrom}"]`
    ) as HTMLElement | null
  }

  const getInteraction = () => {
    const view = editorView()
    return view ? readDesktopTableInteraction(view.state, tableFrom) : null
  }

  const getParsedBounds = () => {
    if (liveSection) return domSectionToParsedBounds(liveSection)
    const interaction = getInteraction()
    return interaction?.outlinedSection ? domSectionToParsedBounds(interaction.outlinedSection) : null
  }

  const paintSection = (section: DesktopTableSection | null) => {
    const block = resolveBlock()
    if (block) applyDesktopOutlineHighlight(block, section)
  }

  const enterCellMode = (
    view: EditorView,
    cell: CellLocation,
    pointer?: { clientX: number; clientY: number },
    initialInsertText?: string
  ) => {
    view.dispatch({
      effects: [
        setDesktopTableInteraction.of({
          tableFrom,
          activeCell: cell,
          anchorCell: cell,
          outlinedSection: DesktopTableSection.ofCell(cell),
          mode: 'cell'
        }),
        pendingTableCellFocus.of({
          tableFrom,
          rowIndex: domRowToParsedRow(cell.row),
          colIndex: cell.col,
          clientX: pointer?.clientX,
          clientY: pointer?.clientY,
          placeAtEnd: pointer == null && !initialInsertText,
          initialInsertText
        })
      ]
    })
  }

  const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element) || target.closest(CHROME_SELECTOR) || !tableEl) return

      const block = resolveBlock()
      const view = editorView()
      if (!block || !view) return

      const hit = cellAtPoint(block, event.clientX, event.clientY, target instanceof Element ? target : null)
      if (!hit) return

      const interaction = getInteraction()

      // 已在嵌套 CM 内点击：交给 CM 处理光标
      if (isTableCellEditorFocused() && isCellInnerTarget(target)) {
        const editorCell = (document.activeElement as HTMLElement)?.closest(
          '.cm-table-cell-editor'
        ) as HTMLElement | null
        const prevRow = Number(editorCell?.dataset.row)
        const prevCol = Number(editorCell?.dataset.col)
        if (prevRow === hit.row && prevCol === hit.col) return
      }

      if (isTableCellEditorFocused()) {
        const editorCell = (document.activeElement as HTMLElement)?.closest(
          '.cm-table-cell-editor'
        ) as HTMLElement | null
        const prevRow = Number(editorCell?.dataset.row)
        const prevCol = Number(editorCell?.dataset.col)
        if (prevRow !== hit.row || prevCol !== hit.col) {
          commitDesktopCellEditors(block, view)
        }
      }

      // ckant：已选中单格再次点击内容区 → 直接进入编辑并落光标
      if (
        interaction &&
        interaction.mode === 'hidden' &&
        interaction.outlinedSection.isSingleCell() &&
        cellEquals(interaction.activeCell, hit) &&
        isCellInnerTarget(target)
      ) {
        event.preventDefault()
        enterCellMode(view, hit, { clientX: event.clientX, clientY: event.clientY })
        return
      }

      // 框选：仅在拖拽时 preventDefault，避免阻断后续 click/selection
      if (!isTableCellEditorFocused()) {
        event.preventDefault()
      }

      outlineAnchor = hit
      liveSection = DesktopTableSection.ofCell(hit)

      DesktopOutlineSession.start(
        block,
        hit,
        event,
        {
          onOutlineStart: (anchor) => {
            outlineAnchor = anchor
            liveSection = DesktopTableSection.ofCell(anchor)
            paintSection(liveSection)
          },
          onBeforeOutlineDrag: () => {
            window.getSelection()?.removeAllRanges()
            blurTableCellEditor()
            commitDesktopCellEditors(block, view)
            block.classList.add('cm-table-block--range-dragging')
            dispatchDesktopInteraction(view, {
              tableFrom,
              activeCell: hit,
              anchorCell: outlineAnchor ?? hit,
              outlinedSection: liveSection ?? DesktopTableSection.ofCell(hit),
              mode: 'hidden'
            })
          },
          onOutlineExpand: (section) => {
            liveSection = section
            paintSection(section)
          },
          onOutlineEnd: (section, dragged, pointer) => {
            liveSection = null
            block.classList.remove('cm-table-block--range-dragging')
            paintSection(section)
            const anchor = outlineAnchor ?? hit
            const head = DesktopTableSection.resolveHead(section, anchor)

            if (!dragged && section.isSingleCell()) {
              dispatchDesktopInteraction(view, {
                tableFrom,
                activeCell: head,
                anchorCell: anchor,
                outlinedSection: section,
                mode: 'hidden'
              })
              block.focus()
              return
            }

            dispatchDesktopInteraction(view, {
              tableFrom,
              activeCell: head,
              anchorCell: anchor,
              outlinedSection: section,
              mode: 'hidden'
            })
            block.focus()
          },
          getTableRoot: () => block,
          getScrollElements: () => ({
            x: scrollHost ?? root,
            y: editorView()?.scrollDOM ?? root
          })
        },
        {
          shiftKey: event.shiftKey,
          existingAnchor: event.shiftKey && interaction ? interaction.anchorCell : undefined
        }
      )
  }

  root.addEventListener('pointerdown', onPointerDown, true)

  const onDoubleClick = (event: MouseEvent) => {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element) || target.closest(CHROME_SELECTOR) || !tableEl) return
    const block = resolveBlock()
    const view = editorView()
    if (!block || !view) return
    const hit = cellAtPoint(block, event.clientX, event.clientY, target)
    if (!hit || !isCellInnerTarget(target)) return
    event.preventDefault()
    if (isTableCellEditorFocused()) {
      commitDesktopCellEditors(block, view)
    }
    enterCellMode(view, hit, { clientX: event.clientX, clientY: event.clientY })
  }

  root.addEventListener('dblclick', onDoubleClick, true)

  const onContextMenu = (event: MouseEvent) => {
    if (isDesktopCellEditorFocused()) return
    const target = event.target
    if (!(target instanceof Element) || target.closest(CHROME_SELECTOR)) return
    const block = resolveBlock()
    const view = editorView()
    if (!block || !view) return
    const interaction = getInteraction()
    if (!interaction || interaction.outlinedSection.isSingleCell()) return
    if (!block.contains(target)) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = domSectionToParsedBounds(interaction.outlinedSection)
    showTableContextMenu(
      [
        { id: 'cut-range', label: '剪切' },
        { id: 'copy-range', label: '复制' },
        { id: 'paste-range', label: '粘贴' },
        { id: 'clear-range', label: '清空选中的单元格' }
      ],
      event.clientX,
      event.clientY,
      (id) => {
        if (id === 'copy-range') {
          desktopCopyTableRange(block, bounds, view)
          return
        }
        if (id === 'cut-range') {
          desktopCopyTableRange(block, bounds, view)
          desktopClearTableRange(block, bounds)
          commitDesktopTableToDoc(view, block)
          return
        }
        if (id === 'paste-range') {
          void readClipboardTextForTablePaste().then((text) => {
            if (!text) return
            runDesktopTablePaste(view, text)
          })
          return
        }
        if (id === 'clear-range') {
          desktopClearTableRange(block, bounds)
          commitDesktopTableToDoc(view, block)
        }
      }
    )
  }

  root.addEventListener('contextmenu', onContextMenu, true)

  const onKeyDown = (event: KeyboardEvent) => {
    if (isDesktopCellEditorFocused()) return
    const block = resolveBlock()
    const view = editorView()
    if (!view || !block) return
    const interaction = getInteraction()
    if (!interaction) return

    if (
      (isTableTypeToEditKey(event) || event.key === 'F2') &&
      interaction.mode === 'hidden' &&
      interaction.outlinedSection.isSingleCell()
    ) {
      event.preventDefault()
      enterCellMode(
        view,
        interaction.activeCell,
        undefined,
        isTableTypeToEditKey(event) ? event.key : undefined
      )
      return
    }

    const navKey = matchDesktopNavigateKey(event)
    if (event.key === 'Escape') {
      event.preventDefault()
      dispatchDesktopInteraction(view, null)
      const tableTo = findTableToByFrom(view.state, tableFrom)
      if (tableTo != null) placeCursorAfterTable(view, tableTo)
      return
    }

    if (navKey) {
      const range = findCurrentTableRange(view, block)
      const table = range ? parseTableFromDoc(view.state.doc, range.from, range.to) : null
      if (range && table) {
        event.preventDefault()
        runDesktopNavigate(view, tableFrom, range.to, table, interaction, navKey)
        block.focus()
        return
      }
    }

    const bounds = getParsedBounds()
    if (!bounds) return
    const mod = event.metaKey || event.ctrlKey
    if (mod && event.key === 'c') {
      event.preventDefault()
      desktopCopyTableRange(block, bounds, view)
      return
    }
    if (mod && event.key === 'x') {
      event.preventDefault()
      desktopCopyTableRange(block, bounds, view)
      desktopClearTableRange(block, bounds)
      commitDesktopTableToDoc(view, block)
      return
    }
    if (mod && event.key === 'v') {
      event.preventDefault()
      void readClipboardTextForTablePaste().then((text) => {
        if (!text) return
        runDesktopTablePaste(view, text)
      })
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      const range = findCurrentTableRange(view, block)
      const grid = readTableGridFromDesktopBlock(block, view)
      if (grid && range && tryDeleteEmptyTableStructure(view, tableFrom, range.to, grid, bounds)) {
        commitDesktopTableToDoc(view, block)
        return
      }
      desktopClearTableRange(block, bounds)
      commitDesktopTableToDoc(view, block)
      dispatchDesktopInteraction(view, {
        ...interaction,
        outlinedSection: DesktopTableSection.ofCell(interaction.activeCell)
      })
    }
  }

  const onClipboard = (kind: 'copy' | 'cut' | 'paste', event: ClipboardEvent) => {
    if (isDesktopCellEditorFocused()) return
    const block = resolveBlock()
    const bounds = getParsedBounds()
    const view = editorView()
    if (!block || !bounds) return
    if (kind === 'paste') {
      const text = event.clipboardData?.getData('text/plain')
      if (!text || !view) return
      event.preventDefault()
      runDesktopTablePaste(view, text)
      return
    }
    event.preventDefault()
    desktopCopyTableRange(block, bounds, view ?? undefined)
    if (kind === 'cut') {
      if (!view) return
      desktopClearTableRange(block, bounds)
      commitDesktopTableToDoc(view, block)
    }
  }

  const onCopy = (e: ClipboardEvent) => onClipboard('copy', e)
  const onCut = (e: ClipboardEvent) => onClipboard('cut', e)
  const onPaste = (e: ClipboardEvent) => onClipboard('paste', e)

  root.addEventListener('keydown', onKeyDown)
  root.addEventListener('copy', onCopy)
  root.addEventListener('cut', onCut)
  root.addEventListener('paste', onPaste)

  const onSelectionChange = () => {
    if (isDesktopCellEditorFocused()) return
    const interaction = getInteraction()
    if (!interaction || interaction.mode !== 'hidden') return
    if (!interaction.outlinedSection.isSingleCell()) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const block = resolveBlock()
    const view = editorView()
    if (!block || !view) return
    const cellEl = block.querySelector(
      `.cm-table-grid-cell[data-row="${interaction.activeCell.row}"][data-col="${interaction.activeCell.col}"]`
    )
    if (!cellEl || !sel.anchorNode || !cellEl.contains(sel.anchorNode)) return
    enterCellMode(view, interaction.activeCell)
  }

  document.addEventListener('selectionchange', onSelectionChange)

  return () => {
    root.removeEventListener('pointerdown', onPointerDown, true)
    root.removeEventListener('dblclick', onDoubleClick, true)
    root.removeEventListener('contextmenu', onContextMenu, true)
    root.removeEventListener('keydown', onKeyDown)
    root.removeEventListener('copy', onCopy)
    root.removeEventListener('cut', onCut)
    root.removeEventListener('paste', onPaste)
    document.removeEventListener('selectionchange', onSelectionChange)
  }
}
