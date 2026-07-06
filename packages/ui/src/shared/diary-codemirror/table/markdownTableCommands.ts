import type { EditorView } from '@codemirror/view'
import type { KeyBinding } from '@codemirror/view'
import { serializeTable } from './table.model'

const EMPTY_TABLE = serializeTable(
  ['', ''],
  [
    ['', ''],
    ['', '']
  ],
  undefined,
  { prettify: true }
)

export function insertEmptyMarkdownTable(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const prefix = line.text.trim().length === 0 ? '' : '\n\n'
  const insert = `${prefix}${EMPTY_TABLE}\n\n`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length, head: from + insert.length }
  })
  return true
}

/** 输入 `| |` 后按 Mod-Enter 插入 2×2 空表（轻量 autocompleter 替代） */
export function insertTableFromPipeLine(view: EditorView): boolean {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  if (line.text.trim() !== '|') return false
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: EMPTY_TABLE },
    selection: { anchor: line.from + EMPTY_TABLE.length, head: line.from + EMPTY_TABLE.length }
  })
  return true
}

export const insertEmptyMarkdownTableKeymap: KeyBinding[] = [
  { key: 'Mod-Shift-t', run: insertEmptyMarkdownTable },
  { key: 'Mod-Enter', run: insertTableFromPipeLine }
]
