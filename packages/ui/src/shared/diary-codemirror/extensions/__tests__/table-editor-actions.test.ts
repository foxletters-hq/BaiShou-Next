import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { resolveTableReplaceRange } from '../table-editor-actions'

describe('resolveTableReplaceRange', () => {
  it('should fall back to pipe range when no table node exists', () => {
    const state = EditorState.create({ doc: '| a | b |\n| - | - |\n| 1 | 2 |\n' })
    expect(resolveTableReplaceRange(state, 0, 12)).toEqual({ from: 0, to: 12 })
  })
})
