import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const screenSrc = readFileSync(join(dir, '..', 'OnboardingScreen.tsx'), 'utf8')
const welcomeSrc = readFileSync(join(dir, '..', 'components', 'OnboardingWelcomeSlide.tsx'), 'utf8')
const profileSrc = readFileSync(join(dir, '..', 'components', 'OnboardingProfileSlide.tsx'), 'utf8')
const src = [screenSrc, welcomeSrc, profileSrc].join('\n')

describe('mobile onboarding chrome', () => {
  it('should collect user profile on a dedicated profile slide with date picker for birthday and no gender hint text', () => {
    expect(screenSrc).toContain('OnboardingProfileSlide')
    expect(welcomeSrc).not.toContain('Input')
    expect(profileSrc).toContain("t('onboarding.profile_title'")
    expect(profileSrc).toContain('Input')
    expect(profileSrc).toContain("t('onboarding.nickname_label'")
    expect(profileSrc).toContain('DatePickerFloatingModal')
    expect(profileSrc).not.toContain('onboarding.profile_hint')
    expect(src).toContain('persistOnboardingProfile')
    expect(src).toContain('syncOnboardingProfileToVault')
    expect(src).toContain('requireNicknameBeforeLeave')
  })

  it('should keep onboarding profile and quick-start keys in all four locale files', () => {
    const i18nDir = join(dir, '../../../../../../packages/shared/src/i18n')
    const keys = [
      'profile_title',
      'nickname_label',
      'nickname_placeholder',
      'nickname_required',
      'birthday_label',
      'birthday_placeholder',
      'gender_label',
      'api_guide_title',
      'api_guide_desc'
    ]
    for (const locale of ['zh.i18n.json', 'zh_TW.i18n.json', 'en.i18n.json', 'ja.i18n.json']) {
      const json = readFileSync(join(i18nDir, locale), 'utf8')
      for (const key of keys) {
        expect(json, `${locale} missing ${key}`).toContain(`"${key}"`)
      }
    }
  })

  it('should dismiss legacy migration prompt upon finishing onboarding', () => {
    expect(screenSrc).toContain('LEGACY_MIGRATION_PROMPT_DISMISSED_KEY')
    expect(screenSrc).toContain("AsyncStorage.setItem(LEGACY_MIGRATION_PROMPT_DISMISSED_KEY, '1')")
  })
})
