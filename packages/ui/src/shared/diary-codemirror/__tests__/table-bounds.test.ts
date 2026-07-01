import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { parseTableFromDoc } from '../table/table.model'
import { buildMarkerHidingDecorations } from '../extensions/build'

describe('table bounds', () => {
  let view: EditorView | null = null
  afterEach(() => { view?.destroy(); view = null })

  it('compares syntax tree Table bounds vs parseTableFromDoc', () => {
    const docs = [
      '| Name | Value |\n| --- | --- |\n| foo | bar |\n',
      '| Name | Value |\n| --- | --- |\n| foo | bar |',
      '# tag\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nhello',
    ]
    for (const doc of docs) {
      const parent = document.createElement('div')
      view = new EditorView({
        parent,
        state: EditorState.create({ doc, selection: { anchor: doc.length }, extensions: [markdown({ base: markdownLanguage })] })
      })
      const tree = syntaxTree(view.state)
      tree.iterate({
        enter(node) {
          if (node.type.name !== 'Table') return
          const parsed = parseTableFromDoc(view!.state.doc, node.from, node.to)
          if (parsed) {
            expect({ from: parsed.from, to: parsed.to }).toEqual({ from: node.from, to: node.to })
            expect(() => buildMarkerHidingDecorations(view!.state)).not.toThrow()
          }
        }
      })
      parent.remove()
    }
  })
})
