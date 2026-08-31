import { describe, expect, it } from 'vitest'
import { NOTEBOOK_CARD_ICONS, getNotebookCardAppearance } from '../notebook-card-appearance'

describe('getNotebookCardAppearance', () => {
  it('uses a stored cover tone and emoji when valid', () => {
    const hashed = getNotebookCardAppearance('nb_same')
    const overridden = getNotebookCardAppearance('nb_same', {
      coverTone: 'sand',
      coverIcon: '🧭'
    })
    expect(overridden.tone).toBe('sand')
    expect(overridden.icon).toBe('🧭')
    expect(NOTEBOOK_CARD_ICONS).toContain(hashed.icon)
  })

  it('maps a legacy lucide id to the matching emoji', () => {
    expect(getNotebookCardAppearance('nb_same', { coverIcon: 'compass' }).icon).toBe('🧭')
  })

  it('falls back to the hashed appearance when cover fields are empty', () => {
    const hashed = getNotebookCardAppearance('nb_auto')
    expect(getNotebookCardAppearance('nb_auto', { coverTone: '', coverIcon: '' })).toEqual(hashed)
    expect(getNotebookCardAppearance('nb_auto', { coverTone: 'navy', coverIcon: 'book-open/x' })).toEqual(
      hashed
    )
  })
})
