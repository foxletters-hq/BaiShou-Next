import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const weather = readFileSync(join(here, '../../WeatherPicker/WeatherPicker.tsx'), 'utf8')
const mood = readFileSync(join(here, '../../MoodPicker/MoodPicker.tsx'), 'utf8')
const chrome = readFileSync(join(here, '../DiaryEditorChrome.tsx'), 'utf8')
const styles = readFileSync(join(here, '../diary-editor.styles.ts'), 'utf8')

describe('diary editor meta controls visual alignment', () => {
  it('uses borderControl for every meta option outline', () => {
    expect(weather).toContain('colors.primary : colors.borderControl')
    expect(mood).toContain('colors.primary : colors.borderControl')
    expect(chrome).toContain('props.isTtsPlaying ? colors.primary : colors.borderControl')
    expect(chrome).toContain('props.isFavorite ? colors.warning : colors.borderControl')
  })

  it('uses the standard mobile control height and radius', () => {
    expect(weather).toContain('height: mobileControlTokens.height')
    expect(weather).toContain('borderRadius: mobileControlTokens.radius')
    expect(mood).toContain('height: mobileControlTokens.height')
    expect(mood).toContain('borderRadius: mobileControlTokens.radius')
    expect(styles).toContain('width: mobileControlTokens.height')
    expect(styles).toContain('borderRadius: mobileControlTokens.radius')
  })

  it('keeps a 1px outline so active colors do not change control size', () => {
    expect(weather).toContain('borderWidth: 1')
    expect(mood).toContain('borderWidth: 1')
    expect(weather).not.toContain('borderWidth: open ? 1.5 : 1')
    expect(mood).not.toContain('borderWidth: open ? 1.5 : 1')
  })
})
