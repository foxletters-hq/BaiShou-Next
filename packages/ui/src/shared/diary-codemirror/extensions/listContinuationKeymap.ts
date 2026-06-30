import { EditorView } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'

const BULLET_LIST_LINE_RE = /^(\s*)([-*+])\s(.*)$/

/** Enter 在列表行自动续行 `- `；空列表项时退出列表 */
export function continueMarkdownBulletList(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  if (from !== to) return false

  const line = state.doc.lineAt(from)
  const match = line.text.match(BULLET_LIST_LINE_RE)
  if (!match) return false

  const indent = match[1] ?? ''
  const marker = match[2] ?? '-'
  const content = match[3] ?? ''

  if (content.trim() === '') {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: indent },
      selection: { anchor: line.from + indent.length }
    })
    return true
  }

  const insert = `\n${indent}${marker} `
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length }
  })
  return true
}

function handleListEnter(view: EditorView): boolean {
  return continueMarkdownBulletList(view)
}

export const listContinuationKeymap = keymap.of([
  { key: 'Enter', run: handleListEnter },
  { key: 'Shift-Enter', run: handleListEnter }
])

/** 移动端软键盘 Enter 常走 beforeinput，不一定触发 keymap */
export const listContinuationInputHandler = EditorView.domEventHandlers({
  beforeinput(event, view) {
    if (event.inputType !== 'insertLineBreak' && event.inputType !== 'insertParagraph') {
      return false
    }
    if (!handleListEnter(view)) return false
    event.preventDefault()
    return true
  }
})

export const listContinuationExtension: Extension = [
  Prec.highest(listContinuationKeymap),
  Prec.highest(listContinuationInputHandler)
]
