import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { Prec, type Extension, type Transaction } from '@codemirror/state'
import { EditorView, type DOMEventHandlers, type KeyBinding, keymap } from '@codemirror/view'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { drawSelection } from '@codemirror/view'

const nestedCellEditorTheme = EditorView.theme({
  '&': {
    height: 'auto',
    width: '100%',
    outline: 'none'
  },
  '.cm-scroller': {
    overflow: 'hidden',
    fontFamily: 'inherit',
    width: '100%'
  },
  '.cm-content': {
    padding: '7px 9px',
    minHeight: '1.5em',
    lineHeight: '1.5'
  },
  '.cm-line': {
    padding: '0 1px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  '.cm-cursor': {
    marginLeft: '0'
  }
})

export type TableCellEditorOptions = {
  parent: HTMLElement
  text: string
  rootEditor: EditorView
  /** 单元格内快捷键（ckant extensions，如 defaultKeymap） */
  cellKeyBindings?: readonly KeyBinding[]
  extraExtensions?: Extension[]
  /** 委托给根编辑器的快捷键（ckant globalKeyBindings，如 history/search） */
  globalKeyBindings?: readonly KeyBinding[]
  onChange: (transaction: Transaction) => void
  eventHandlers?: DOMEventHandlers<unknown>
}

/** 嵌套单元格 CodeMirror（对齐 ckant cellEditor.ts） */
export function createTableCellEditor(options: TableCellEditorOptions): EditorView {
  const {
    parent,
    text,
    rootEditor,
    cellKeyBindings = defaultKeymap,
    extraExtensions = [],
    globalKeyBindings = [...historyKeymap, ...searchKeymap],
    onChange,
    eventHandlers
  } = options

  const cellExtensions: Extension[] = [
    Prec.highest(nestedCellEditorTheme),
    ...extraExtensions,
    keymap.of(cellKeyBindings.filter((kb) => kb.run)),
    Prec.lowest([
      keymap.of(
        globalKeyBindings
          .filter((kb) => kb.run)
          .map((keyBinding) => ({
            ...keyBinding,
            run: () => keyBinding.run!(rootEditor),
            shift: keyBinding.shift ? () => keyBinding.shift!(rootEditor) : undefined
          }))
      ),
      markdown({ base: markdownLanguage, addKeymap: false }),
      EditorView.lineWrapping,
      drawSelection(),
      EditorView.contentAttributes.of({ spellcheck: 'true' }),
      ...(eventHandlers ? [EditorView.domEventHandlers(eventHandlers)] : [])
    ])
  ]

  return new EditorView({
    parent,
    doc: text,
    extensions: cellExtensions,
    dispatchTransactions(transactions, view) {
      view.update(transactions)
      transactions.forEach(onChange)
    }
  })
}

export const tableCellEditorKeymap: KeyBinding[] = [...defaultKeymap]
