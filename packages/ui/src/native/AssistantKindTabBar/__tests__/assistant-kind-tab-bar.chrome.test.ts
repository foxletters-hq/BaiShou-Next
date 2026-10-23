import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AssistantKindTabBar.tsx'),
  'utf8'
)

describe('native AssistantKindTabBar chrome', () => {
  it('should paint the selected tab surface before the sliding indicator is measured', () => {
    expect(src).toContain('backgroundColor: colors.bgSurface')
    expect(src).toContain("activeKind === 'companion'")
    expect(src).toContain('hasMeasuredIndicatorRef')
    expect(src).toContain('slideAnim.value = next')
    expect(src).toContain('tabWidth > 0')
  })
})
