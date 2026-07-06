import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  shouldExplicitCaretPlacement,
  shouldPlaceCaretOnTapEnd
} from '../extensions/tablePostTableTouchPolicy'

describe('tablePostTableTouchPolicy', () => {
  it('uses native caret on plain cm-content for touch taps', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({
      state: EditorState.create({ doc: 'hello world foo bar' }),
      parent
    })
    const line = view.contentDOM.querySelector('.cm-line') as HTMLElement
    expect(line).toBeTruthy()

    expect(shouldExplicitCaretPlacement(view, line, 100)).toBe(false)
    expect(shouldPlaceCaretOnTapEnd(view, line, 100, true)).toBe(false)
    expect(shouldPlaceCaretOnTapEnd(view, line, 100, false)).toBe(true)

    view.destroy()
    parent.remove()
  })
})
