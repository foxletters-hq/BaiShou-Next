import { describe, expect, it } from 'vitest'
import { mergePageReorder, isSameShortcutOrder } from '../usePromptShortcutSheet'

describe('mergePageReorder', () => {
  const shortcuts = [
    { id: '1', icon: '', name: 'A', content: 'a' },
    { id: '2', icon: '', name: 'B', content: 'b' },
    { id: '3', icon: '', name: 'C', content: 'c' },
    { id: '4', icon: '', name: 'D', content: 'd' },
    { id: '5', icon: '', name: 'E', content: 'e' }
  ]

  it('replaces only the current page slice', () => {
    const reorderedPage = [
      { id: '3', icon: '', name: 'C', content: 'c' },
      { id: '2', icon: '', name: 'B', content: 'b' }
    ]
    const next = mergePageReorder(shortcuts, 1, 2, reorderedPage)
    expect(next.map((item) => item.id)).toEqual(['1', '3', '2', '4', '5'])
  })
})

describe('isSameShortcutOrder', () => {
  it('should treat identical id sequences as unchanged', () => {
    expect(isSameShortcutOrder([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }, { id: 'b' }])).toBe(true)
  })

  it('should treat a different id sequence as changed', () => {
    expect(isSameShortcutOrder([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'a' }])).toBe(false)
  })
})
