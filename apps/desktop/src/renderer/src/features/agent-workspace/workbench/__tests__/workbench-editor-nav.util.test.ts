import { describe, expect, it } from 'vitest'
import {
  EMPTY_EDITOR_NAV,
  recordEditorFileVisit,
  stepEditorFileHistory
} from '../workbench-editor-nav.util'

describe('workbench editor file history', () => {
  it('should return to the previous file when stepping back', () => {
    const visited = ['a.md', 'b.md'].reduce(
      (history, path) => recordEditorFileVisit(history, path),
      EMPTY_EDITOR_NAV
    )
    const stepped = stepEditorFileHistory(visited, 'back')
    expect(stepped.target).toBe('a.md')
    expect(stepped.history.current).toBe('a.md')
    expect(stepEditorFileHistory(stepped.history, 'forward').target).toBe('b.md')
  })

  it('should not move when there is no previous file', () => {
    const visited = recordEditorFileVisit(EMPTY_EDITOR_NAV, 'a.md')
    expect(stepEditorFileHistory(visited, 'back').target).toBeNull()
  })
})
