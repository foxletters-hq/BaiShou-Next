import { describe, expect, it } from 'vitest'

function nextSegment<T extends string>(
  options: ReadonlyArray<{ value: T }>,
  current: T,
  next: T
): T {
  return options.some((option) => option.value === next) ? next : current
}

describe('SegmentedControl option switch', () => {
  it('should keep the current value when the next option is unknown', () => {
    expect(
      nextSegment([{ value: 'vectors' }, { value: 'graph' }], 'vectors', 'other' as 'graph')
    ).toBe('vectors')
  })

  it('should switch to a listed option', () => {
    expect(nextSegment([{ value: 'vectors' }, { value: 'graph' }], 'vectors', 'graph')).toBe(
      'graph'
    )
  })
})
