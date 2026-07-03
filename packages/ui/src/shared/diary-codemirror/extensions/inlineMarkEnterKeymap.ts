import { EditorView } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'

const INLINE_MARK_DELIMS = [
  { open: '**', close: '**' },
  { open: '~~', close: '~~' },
  { open: '`', close: '`' },
  { open: '*', close: '*' }
] as const

/**
 * Live preview 用 widget 隐藏行尾 `**` 时，点击视觉上的「加粗末尾」常落在闭合符之前。
 * 此时直接 Enter 会得到 `**bold\n**`；应在整段行内标记闭合后再换行。
 */
export function resolveInlineEnterInsertPos(text: string, offset: number): number | null {
  for (const { open, close } of INLINE_MARK_DELIMS) {
    let from = 0
    while (from <= text.length) {
      const openIdx = text.indexOf(open, from)
      if (openIdx === -1) break
      const closeIdx = text.indexOf(close, openIdx + open.length)
      if (closeIdx === -1) break
      const markEnd = closeIdx + close.length
      if (offset > openIdx && offset < markEnd && offset >= closeIdx) {
        return markEnd
      }
      from = openIdx + open.length
    }
  }
  return null
}

export function continueInlineMarkAtLineEnd(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  if (from !== to) return false

  const line = view.state.doc.lineAt(from)
  const offset = from - line.from
  const insertAt = resolveInlineEnterInsertPos(line.text, offset)
  if (insertAt === null) return false

  const pos = line.from + insertAt
  view.dispatch({
    changes: { from: pos, insert: '\n' },
    selection: { anchor: pos + 1 }
  })
  return true
}

function handleInlineEnter(view: EditorView): boolean {
  return continueInlineMarkAtLineEnd(view)
}

export const inlineMarkEnterKeymap = keymap.of([
  { key: 'Enter', run: handleInlineEnter },
  { key: 'Shift-Enter', run: handleInlineEnter }
])

export const inlineMarkEnterInputHandler = EditorView.domEventHandlers({
  beforeinput(event, view) {
    if (event.inputType !== 'insertLineBreak' && event.inputType !== 'insertParagraph') {
      return false
    }
    if (!handleInlineEnter(view)) return false
    event.preventDefault()
    return true
  }
})

export const inlineMarkEnterExtension: Extension = [
  Prec.highest(inlineMarkEnterKeymap),
  Prec.highest(inlineMarkEnterInputHandler)
]
