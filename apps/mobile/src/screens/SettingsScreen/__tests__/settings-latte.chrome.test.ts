import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const i18nDir = join(dir, '../../../../../../packages/shared/src/i18n')

describe('mobile settings latte chrome', () => {
  it('should mount LatteSettingsSection from the companion hub', () => {
    const hub = readFileSync(join(dir, '..', 'settingsHubItems.ts'), 'utf8')
    const detail = readFileSync(join(dir, '..', 'SettingsDetailScreen.tsx'), 'utf8')
    const section = readFileSync(
      join(dir, '..', 'components', 'LatteSettingsSection.tsx'),
      'utf8'
    )

    expect(hub).toContain("id: 'latte'")
    expect(hub).toContain("section: 'latte'")
    expect(hub).toContain("icon: 'latte'")
    expect(detail).toContain('LatteSettingsSection')
    expect(detail).toContain("case 'latte'")
    expect(section).toContain("@baishou/shared/assets/images/latte-chibi.png")
    expect(section).toContain('latte_display_name')
    expect(section).toContain('latte_origin_quote')
    expect(section).toContain('latte_origin_body')
    expect(section).toContain('latte_docs_link')
    expect(section).toContain('getHelpDocsLatteUrl')
    expect(section).toContain('latte_character_settings_title')
    expect(section).toContain('latte_persona_prompt_title')
    expect(section).toContain('Button')
    expect(section).toContain("from '@baishou/ui/native'")
    expect(section).not.toContain("Button } from 'react-native'")
    expect(section).not.toContain('#fff')
    expect(section).not.toContain('#000')
  })

  it('should keep new latte profile i18n keys in all four locale files', () => {
    const keys = [
      'latte_display_name',
      'latte_display_subtitle',
      'latte_portrait_alt',
      'latte_origin_quote',
      'latte_origin_body',
      'latte_docs_link',
      'latte_character_settings_title'
    ]
    for (const locale of ['zh.i18n.json', 'zh_TW.i18n.json', 'en.i18n.json', 'ja.i18n.json']) {
      const json = readFileSync(join(i18nDir, locale), 'utf8')
      for (const key of keys) {
        expect(json, `${locale} missing ${key}`).toContain(`"${key}"`)
      }
    }
  })
})
