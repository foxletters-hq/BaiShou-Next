import { describe, expect, it } from 'vitest'
import { mergePageReorder, isSameShortcutItems, isSameShortcutOrder } from '../usePromptShortcutSheet'

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

describe('isSameShortcutItems', () => {
  it('returns true when id and item fields are identical', () => {
    const items = [{ id: 's1', command: 'writer', name: 'Writer', description: 'desc', content: 'v1' }]
    expect(isSameShortcutItems(items, [{ ...items[0]! }])).toBe(true)
  })

  it('returns false when skill body content or description is edited in place', () => {
    const prev = [{ id: 's1', command: 'writer', name: 'Writer', description: 'desc', content: 'v1' }]
    const nextContent = [
      { id: 's1', command: 'writer', name: 'Writer', description: 'desc', content: 'v2' }
    ]
    const nextDesc = [
      { id: 's1', command: 'writer', name: 'Writer 2', description: 'desc 2', content: 'v1' }
    ]
    expect(isSameShortcutItems(prev, nextContent)).toBe(false)
    expect(isSameShortcutItems(prev, nextDesc)).toBe(false)
  })
})
