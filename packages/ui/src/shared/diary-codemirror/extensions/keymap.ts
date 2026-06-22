import { keymap } from '@codemirror/view'
import type { EditorView } from '@codemirror/view'

function toggleMarkdownMark(view: EditorView, marker: string): boolean {
  const { from, to } = view.state.selection.main
  const selText = view.state.sliceDoc(from, to)
  const mLen = marker.length

  if (selText.length > 0) {
    const before = view.state.sliceDoc(Math.max(0, from - mLen), from)
    const after = view.state.sliceDoc(to, to + mLen)
    if (before === marker && after === marker) {
      view.dispatch({
        changes: [
          { from: to, to: to + mLen },
          { from: from - mLen, to: from }
        ],
        selection: { anchor: from - mLen, head: to }
      })
    } else {
      view.dispatch({
        changes: { from, to, insert: `${marker}${selText}${marker}` },
        selection: { anchor: from + mLen, head: to + mLen }
      })
    }
    return true
  }

  view.dispatch({
    changes: { from, insert: `${marker}${marker}` },
    selection: { anchor: from + mLen }
  })
  return true
}

export const markdownKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => toggleMarkdownMark(v, '**') },
  { key: 'Mod-i', run: (v) => toggleMarkdownMark(v, '*') },
  { key: 'Mod-`', run: (v) => toggleMarkdownMark(v, '`') }
])
