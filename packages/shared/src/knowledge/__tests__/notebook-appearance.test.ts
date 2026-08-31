import { describe, expect, it } from 'vitest'
import {
  NOTEBOOK_CARD_ICONS,
  NOTEBOOK_CARD_TONES,
  isNotebookCardIcon,
  isNotebookCardTone,
  normalizeNotebookCoverIcon,
  normalizeNotebookCoverImage,
  normalizeNotebookCoverTone,
  notebookCoverImageCandidates,
  notebookCoverImageExt
} from '../notebook-appearance'

describe('notebook-appearance', () => {
  it('accepts the eight cover tones', () => {
    expect(NOTEBOOK_CARD_TONES).toHaveLength(8)
    expect(isNotebookCardTone('mint')).toBe(true)
    expect(isNotebookCardTone('navy')).toBe(false)
    expect(isNotebookCardTone('')).toBe(false)
  })

  it('normalizes invalid cover tones to empty', () => {
    expect(normalizeNotebookCoverTone('peach')).toBe('peach')
    expect(normalizeNotebookCoverTone('PEACH')).toBe('')
    expect(normalizeNotebookCoverTone(null)).toBe('')
    expect(normalizeNotebookCoverTone(undefined)).toBe('')
  })

  it('accepts the cover emojis and maps legacy lucide ids', () => {
    expect(NOTEBOOK_CARD_ICONS).toContain('📖')
    expect(isNotebookCardIcon('✨')).toBe(true)
    expect(isNotebookCardIcon('sparkles')).toBe(false)
    expect(normalizeNotebookCoverIcon('🧭')).toBe('🧭')
    expect(normalizeNotebookCoverIcon('orbit')).toBe('🪐')
    expect(normalizeNotebookCoverIcon('🤖')).toBe('🤖')
    expect(normalizeNotebookCoverIcon('sparkles')).toBe('✨')
    expect(normalizeNotebookCoverIcon('📚/x')).toBe('')
  })

  it('only keeps a cover image inside the notebook folder', () => {
    expect(notebookCoverImageExt('photo.PNG')).toBe('png')
    expect(notebookCoverImageExt('photo.txt')).toBeNull()
    expect(normalizeNotebookCoverImage('nb_1', 'nb_1/cover.webp')).toBe('nb_1/cover.webp')
    expect(normalizeNotebookCoverImage('nb_1', 'nb_2/cover.png')).toBe('')
    expect(normalizeNotebookCoverImage('nb_1', 'nb_1/../cover.png')).toBe('')
    expect(normalizeNotebookCoverImage('nb_1', 'nb_1/sources/a.png')).toBe('')
    expect(notebookCoverImageCandidates('nb_1')).toContain('nb_1/cover.webp')
    expect(notebookCoverImageCandidates('../x')).toEqual([])
  })
})
