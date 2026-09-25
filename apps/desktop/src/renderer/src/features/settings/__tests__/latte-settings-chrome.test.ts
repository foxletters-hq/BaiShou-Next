import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const settingsDir = join(dir, '..')
const i18nDir = join(dir, '../../../../../../../../packages/shared/src/i18n')

function readSettings(fileName: string): string {
  return readFileSync(join(settingsDir, fileName), 'utf8')
}

describe('desktop latte settings chrome', () => {
  it('should show Latte portrait, name, and origin before persona settings', () => {
    const pane = readSettings('components/LatteSettingsPane.tsx')
    const intro = readSettings('components/LatteProfileIntro.tsx')
    const css = readSettings('components/LatteProfileIntro.module.css')

    expect(pane).toContain('<LatteProfileIntro')
    expect(pane.indexOf('<LatteProfileIntro')).toBeLessThan(
      pane.indexOf('latte_persona_prompt_title')
    )
    expect(intro).toContain("@baishou/shared/assets/images/latte-chibi.png")
    expect(intro).toContain('latte_display_name')
    expect(intro).toContain('latte_origin_quote')
    expect(intro).toContain('latte_origin_body')
    expect(intro).toContain('latte_docs_link')
    expect(intro).toContain('getHelpDocsLatteUrl')
    expect(intro).toContain('openExternal')
    expect(css).toContain('var(--bg-surface)')
    expect(css).toContain('var(--border-card)')
    expect(css).toContain('var(--radius-md)')
    expect(css).not.toContain('#fff')
    expect(css).not.toContain('#000')
    expect(pane).toContain("from '@baishou/ui'")
    expect(pane).toContain('latte_persona_prompt_title')
    expect(pane).toContain('latte_custom_prompt_title')
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
