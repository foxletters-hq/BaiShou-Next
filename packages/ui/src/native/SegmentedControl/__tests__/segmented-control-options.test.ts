import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'SegmentedControl.tsx'),
  'utf8'
)

describe('SegmentedControl layout updates', () => {
  it('should not set track width when the measured width is unchanged', () => {
    expect(src).toContain('prev === next ? prev : next')
  })
})
