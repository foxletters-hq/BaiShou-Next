import { describe, expect, it } from 'vitest'
import { applyShortcutDisplayOrder } from '../prompt-shortcut-order.util'

describe('applyShortcutDisplayOrder', () => {
  it('should keep a custom item first when its id is first in saved order', () => {
    const items = [
      { id: 'builtin', name: 'create-skill' },
      { id: 'custom-1', name: 'my' }
    ]
    const next = applyShortcutDisplayOrder(items, ['custom-1', 'builtin'])
    expect(next.map((item) => item.id)).toEqual(['custom-1', 'builtin'])
  })

  it('should append items that are missing from the saved order', () => {
    const items = [
      { id: 'a', name: 'a' },
      { id: 'b', name: 'b' },
      { id: 'c', name: 'c' }
    ]
    const next = applyShortcutDisplayOrder(items, ['b', 'a'])
    expect(next.map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })

  it('should return the original list when order is empty', () => {
    const items = [{ id: 'a', name: 'a' }]
    expect(applyShortcutDisplayOrder(items, [])).toBe(items)
    expect(applyShortcutDisplayOrder(items, null)).toBe(items)
  })

  it('should match by command when order was saved before skill id normalization', () => {
    const items = [
      { id: 'builtin', command: 'create-skill', name: 'create-skill' },
      { id: '18', command: '18', name: '18' }
    ]
    const next = applyShortcutDisplayOrder(items, ['18', 'builtin'])
    expect(next.map((item) => item.id)).toEqual(['18', 'builtin'])
  })
})
