import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const modal = readFileSync(join(dir, '..', 'DatePickerFloatingModal.tsx'), 'utf8')

describe('DatePickerFloatingModal chrome', () => {
  it('should match diary month-picker header type at 16/600', () => {
    expect(modal).toContain('mobileTypography.primary.fontSize')
    expect(modal).not.toContain('settingsTypography.section')
    expect(modal).not.toContain('fontSize: 18')
  })

  it('should use outlined sm native Buttons in the footer instead of filled Pressables', () => {
    expect(modal).toContain('Button')
    expect(modal).toContain('variant="outlined"')
    expect(modal).toContain('size="sm"')
    expect(modal).not.toContain('backgroundColor: colors.primary')
    expect(modal).not.toContain('styles.footerBtn')
  })
})
