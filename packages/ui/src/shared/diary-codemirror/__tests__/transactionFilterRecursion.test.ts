import { describe, it, expect } from 'vitest'
import { EditorState, type Annotation, type Transaction } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'

/** 与 apps/mobile/diary-editor-web/src/main.ts viewport 模式的 filter 保持同构 */
const stripScrollIntoViewFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection || !tr.scrollIntoView) return tr
  const annotations = (
    tr as Transaction & { annotations?: readonly Annotation<unknown>[] }
  ).annotations
  return tr.startState.update({
    changes: tr.changes,
    selection: tr.selection,
    effects: tr.effects,
    annotations,
    scrollIntoView: false,
    filter: false
  })
})

describe('transaction filter recursion', () => {
  it('rebuilding the transaction with filter:false neither recurses nor keeps scrollIntoView', () => {
    const parent = document.createElement('div')
    let observedScrollIntoView: boolean | null = null

    const state = EditorState.create({
      doc: 'hello',
      extensions: [
        markdown({ base: markdownLanguage }),
        stripScrollIntoViewFilter,
        EditorView.updateListener.of((update) => {
          for (const tr of update.transactions) {
            if (tr.selection) observedScrollIntoView = tr.scrollIntoView
          }
        })
      ]
    })
    const view = new EditorView({ parent, state })

    expect(() =>
      view.dispatch({ selection: { anchor: 3, head: 3 }, scrollIntoView: true })
    ).not.toThrow()
    expect(view.state.selection.main.head).toBe(3)
    expect(observedScrollIntoView).toBe(false)

    view.destroy()
    parent.remove()
  })
})
