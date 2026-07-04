import type { EditorView } from '@codemirror/view'
import type { Extension, Transaction } from '@codemirror/state'
import { createTableCellEditor } from './tableCellEditor'
import { encodeTableCellText, normalizeTableCellDisplay } from './tableCellText'
import type { KeyBinding } from '@codemirror/view'

export type TableCellEditorHostOptions = {
  parent: HTMLElement
  rowIndex: number
  colIndex: number
  raw: string
  rootEditor: EditorView
  formatDisplay?: (raw: string) => string
  cellKeyBindings?: readonly KeyBinding[]
  extraExtensions?: Extension[]
  onCommit: (raw: string) => void
  onBlur?: () => void
  onFocus: () => void
  onKeyDown?: (event: KeyboardEvent) => boolean | void
  onPaste?: (event: ClipboardEvent) => boolean | void
}

/** 管理嵌套 CM 生命周期与双向同步（对齐 ckant CellEditor.svelte） */
export class TableCellEditorHost {
  readonly rowIndex: number
  readonly colIndex: number
  private readonly view: EditorView
  private updatingFromProp = false

  constructor(options: TableCellEditorHostOptions) {
    this.rowIndex = options.rowIndex
    this.colIndex = options.colIndex

    const formatDisplay = options.formatDisplay ?? normalizeTableCellDisplay
    const display = formatDisplay(options.raw) || ''
    this.view = createTableCellEditor({
      parent: options.parent,
      text: display,
      rootEditor: options.rootEditor,
      cellKeyBindings: options.cellKeyBindings,
      extraExtensions: options.extraExtensions,
      onChange: (transaction) => {
        if (this.updatingFromProp || !transaction.docChanged) return
        const raw = encodeTableCellText(transaction.state.doc.toString())
        options.onCommit(raw)
      },
      eventHandlers: {
        focus: () => options.onFocus(),
        blur: () => options.onBlur?.(),
        keydown: (event) => {
          const handled = options.onKeyDown?.(event)
          return handled === true || event.defaultPrevented
        },
        paste: (event) => {
          const handled = options.onPaste?.(event)
          return handled === true || event.defaultPrevented
        },
        dragstart: (event) => {
          event.preventDefault()
          return true
        },
        beforeinput: (event) => {
          if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
            event.preventDefault()
            return true
          }
          return false
        }
      }
    })
  }

  get editorView(): EditorView {
    return this.view
  }

  focus(placeAtEnd = false): void {
    if (!this.view.hasFocus) {
      this.view.focus()
    }
    if (placeAtEnd) {
      const end = this.view.state.doc.length
      this.view.dispatch({ selection: { anchor: end, head: end } })
    }
  }

  readRaw(): string {
    return encodeTableCellText(this.view.state.doc.toString())
  }

  destroy(): void {
    this.view.destroy()
  }
}

export function isNestedTableCellEditorFocused(): boolean {
  const active = document.activeElement
  return active instanceof HTMLElement && Boolean(active.closest('.cm-table-cell-editor'))
}
