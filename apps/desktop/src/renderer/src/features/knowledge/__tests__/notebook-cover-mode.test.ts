import { describe, expect, it } from 'vitest'
import { resolveNotebookCoverMode } from '../notebook-cover-mode'

describe('resolveNotebookCoverMode', () => {
  it('should return image when a cover image exists', () => {
    expect(resolveNotebookCoverMode(true)).toBe('image')
  })

  it('should return emoji when no cover image exists', () => {
    expect(resolveNotebookCoverMode(false)).toBe('emoji')
  })
})
