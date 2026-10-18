import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mobileTypography } from '../tokens'

const root = dirname(fileURLToPath(import.meta.url))

function cssNum(css: string, name: string): number {
  const match = css.match(new RegExp(`${name}:\\s*(\\d+)(?:px)?`))
  if (!match) throw new Error(`missing ${name}`)
  return Number(match[1])
}

describe('mobileTypography', () => {
  it('should match the mobile font-size CSS variables', () => {
    const css = readFileSync(join(root, '../css-variables.css'), 'utf8')
    expect(mobileTypography.display.fontSize).toBe(cssNum(css, '--mobile-fs-display'))
    expect(Number(mobileTypography.display.fontWeight)).toBe(cssNum(css, '--mobile-fw-display'))
    expect(mobileTypography.title.fontSize).toBe(cssNum(css, '--mobile-fs-title'))
    expect(Number(mobileTypography.title.fontWeight)).toBe(cssNum(css, '--mobile-fw-title'))
    expect(mobileTypography.primary.fontSize).toBe(cssNum(css, '--mobile-fs-primary'))
    expect(Number(mobileTypography.primary.fontWeight)).toBe(cssNum(css, '--mobile-fw-primary'))
    expect(mobileTypography.body.fontSize).toBe(cssNum(css, '--mobile-fs-body'))
    expect(mobileTypography.body.lineHeight).toBe(cssNum(css, '--mobile-lh-body'))
    expect(mobileTypography.secondary.fontSize).toBe(cssNum(css, '--mobile-fs-secondary'))
    expect(Number(mobileTypography.secondary.fontWeight)).toBe(cssNum(css, '--mobile-fw-secondary'))
    expect(mobileTypography.caption.fontSize).toBe(cssNum(css, '--mobile-fs-caption'))
    expect(Number(mobileTypography.caption.fontWeight)).toBe(cssNum(css, '--mobile-fw-caption'))
  })

  it('should be the type source for diary cards and settings rows', () => {
    const card = readFileSync(join(root, '../../native/DiaryCard/DiaryCard.tsx'), 'utf8')
    const item = readFileSync(join(root, '../../native/SettingsItem/SettingsItem.tsx'), 'utf8')
    const section = readFileSync(
      join(root, '../../native/SettingsSection/SettingsSection.tsx'),
      'utf8'
    )
    expect(card).toContain('mobileTypography.display')
    expect(card).toContain('mobileTypography.body')
    expect(card).toContain('mobileTypography.caption')
    expect(card).toContain('mobileTypography.secondary')
    expect(item).toContain('mobileTypography.primary')
    expect(item).toContain('mobileTypography.secondary')
    expect(section).toContain('mobileTypography.title')
    expect(section).toContain('mobileTypography.secondary')
  })
})
