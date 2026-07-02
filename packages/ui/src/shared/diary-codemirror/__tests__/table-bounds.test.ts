import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { parseTableFromDoc } from '../table/table.model'
import { buildMarkerHidingDecorations } from '../extensions/build'
import {
  resolveTableSurfaceRange,
  tableSyntaxTreeTablesChanged
} from '../table/tableBounds'
import { buildTablePreviewDecorations, changeAffectsTables } from '../extensions/tablePreviewField'

describe('table bounds', () => {
  let view: EditorView | null = null
  afterEach(() => {
    view?.destroy()
    view = null
  })

  it('compares syntax tree Table bounds vs parseTableFromDoc', () => {
    const docs = [
      '| Name | Value |\n| --- | --- |\n| foo | bar |\n',
      '| Name | Value |\n| --- | --- |\n| foo | bar |',
      '# tag\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nhello'
    ]
    for (const doc of docs) {
      const parent = document.createElement('div')
      view = new EditorView({
        parent,
        state: EditorState.create({
          doc,
          selection: { anchor: doc.length },
          extensions: [markdown({ base: markdownLanguage })]
        })
      })
      const tree = syntaxTree(view.state)
      tree.iterate({
        enter(node) {
          if (node.type.name !== 'Table') return
          const parsed = parseTableFromDoc(view!.state.doc, node.from, node.to)
          if (parsed) {
            expect(parsed.from).toBe(node.from)
            expect(parsed.to).toBeLessThanOrEqual(node.to)
            expect(() => buildMarkerHidingDecorations(view!.state)).not.toThrow()
          }
        }
      })
      parent.remove()
    }
  })

  it('resolveTableSurfaceRange covers full table lines for replace', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage })]
    })
    const tree = syntaxTree(state)
    let surface: ReturnType<typeof resolveTableSurfaceRange> = null
    tree.iterate({
      enter(node) {
        if (node.type.name !== 'Table') return
        surface = resolveTableSurfaceRange(state, node.from, node.to)
        return false
      }
    })
    expect(surface).toBeTruthy()
    expect(surface!.replaceFrom).toBe(0)
    expect(surface!.replaceTo).toBe(state.doc.line(3).to)
  })

  it('tableSyntaxTreeTablesChanged detects table row append', () => {
    const before = EditorState.create({
      doc: '| A | B |\n| --- | --- |\n| 1 | 2 |\n',
      extensions: [markdown({ base: markdownLanguage })]
    })
    const tr = before.update({
      changes: { from: before.doc.line(3).to, insert: '\n| 3 | 4 |' }
    })
    expect(tableSyntaxTreeTablesChanged(tr)).toBe(true)
  })

  it('changeAffectsTables stays false for edits outside table surface', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nBelow text\n'
    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage })]
    })
    const deco = buildTablePreviewDecorations(state)
    const belowFrom = state.doc.line(5).from
    const tr = state.update({ changes: { from: belowFrom, insert: 'X' } })
    expect(changeAffectsTables(tr, deco)).toBe(false)
  })
})
