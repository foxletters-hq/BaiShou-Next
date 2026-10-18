import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(dir, '..', 'BirthdayPickerField.tsx'), 'utf8')
const indexSrc = readFileSync(join(dir, '..', 'index.ts'), 'utf8')

describe('BirthdayPickerField chrome', () => {
  it('should export BirthdayPickerField and alias BirthdayPicker', () => {
    expect(indexSrc).toContain('BirthdayPickerField')
    expect(indexSrc).toContain('BirthdayPicker')
  })

  it('should use DatePickerFloatingModal instead of raw text input', () => {
    expect(src).toContain('DatePickerFloatingModal')
    expect(src).not.toContain('<Input')
    expect(src).not.toContain('<TextInput')
  })

  it('should support clearable trigger and local date formatting', () => {
    expect(src).toContain('isValidUserBirthday')
    expect(src).toContain('formatLocalDate')
    expect(src).toContain("onChange('')")
    expect(src).toContain('accessibilityRole="button"')
    expect(src).toContain('minHeight: 44')
    expect(src).toContain('sharedTokens.radius.md')
  })

  it('should default to current date when opened without a value', () => {
    expect(src).toContain('defaultPickerDate ?? new Date()')
  })
})
