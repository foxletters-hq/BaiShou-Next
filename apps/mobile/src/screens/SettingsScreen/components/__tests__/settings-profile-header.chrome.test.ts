import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readLocaleCatalog, TEST_LOCALE_CODES } from '@baishou/shared'

const dir = dirname(fileURLToPath(import.meta.url))
const headerSrc = readFileSync(join(dir, '..', 'SettingsProfileHeader.tsx'), 'utf8')
const modalSrc = readFileSync(join(dir, '..', 'SettingsProfileModal.tsx'), 'utf8')

describe('SettingsProfileHeader birthday selector chrome', () => {
  it('should use unified BirthdayPickerField instead of raw text Input for birthday', () => {
    expect(headerSrc).toContain('SettingsProfileModal')
    expect(modalSrc).toContain('BirthdayPickerField')
    expect(modalSrc).toContain('value={formBirthday}')
    expect(modalSrc).toContain('onChange={setFormBirthday}')
    expect(modalSrc).toContain("t('profile.birthday_placeholder'")
    // 不再使用文本输入占位符
    expect(modalSrc).not.toContain('YYYY-MM-DD（如 2000-01-01）')
    expect(modalSrc).not.toContain('onChangeText={setFormBirthday}')
  })

  it('should have birthday_placeholder in all 4 locale files under profile namespace', () => {
    const i18nDir = join(dir, '../../../../../../../packages/shared/src/i18n')
    for (const locale of TEST_LOCALE_CODES) {
      const json = readLocaleCatalog(i18nDir, locale)
      expect(json.profile, `${locale} missing profile namespace`).toBeDefined()
      expect(
        json.profile.birthday_placeholder,
        `${locale} missing profile.birthday_placeholder`
      ).toBeTruthy()
    }
  })

  it('should treat default nickname as empty and validate nickname_default_error in all 4 locales', () => {
    expect(modalSrc).toContain('isDefaultGraphSelfName')
    expect(modalSrc).toContain('nickname_default_error')

    const i18nDir = join(dir, '../../../../../../../packages/shared/src/i18n')
    for (const locale of TEST_LOCALE_CODES) {
      const json = readLocaleCatalog(i18nDir, locale)
      expect(
        json.profile.nickname_default_error,
        `${locale} missing profile.nickname_default_error`
      ).toBeTruthy()
    }
  })
})
