import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const wheel = readFileSync(join(dir, '..', 'DateSelectWheelColumn.tsx'), 'utf8')

describe('DateSelectWheelColumn chrome', () => {
  it('should use mobileTypography for wheel labels instead of oversized 18/16 type', () => {
    expect(wheel).toContain('mobileTypography')
    expect(wheel).toContain('mobileTypography.body.fontSize')
    expect(wheel).toContain('mobileTypography.secondary.fontSize')
    expect(wheel).not.toContain('fontSize: active ? 18 : 16')
  })

  it('should keep selected wheel weight at 600 and leave chrome off 700', () => {
    expect(wheel).toContain("fontWeight: active ? '600'")
    expect(wheel).not.toContain("'700'")
  })
})
