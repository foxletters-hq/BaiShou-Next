import React from 'react'
import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_UI_LANGUAGE_ORDER } from '@baishou/shared'
import type { CompressionPromptLocale } from '@baishou/shared'
import styles from './OnboardingLanguagePage.module.css'

type OnboardingLanguagePageProps = {
  selectedLanguage: CompressionPromptLocale | null
  onSelectLanguage: (lang: CompressionPromptLocale) => void
}

export const OnboardingLanguagePage: React.FC<OnboardingLanguagePageProps> = ({
  selectedLanguage,
  onSelectLanguage
}) => {
  const { t } = useTranslation()

  const getLanguageLabel = (lang: CompressionPromptLocale) => {
    switch (lang) {
      case 'zh':
        return t('onboarding.lang_zh', '简体中文')
      case 'zh-TW':
        return t('onboarding.lang_zh_tw', '繁體中文')
      case 'en':
        return t('onboarding.lang_en', 'English')
      case 'ja':
        return t('onboarding.lang_ja', '日本語')
      default:
        return lang
    }
  }

  return (
    <div className={styles.pageInner}>
      <div className={styles.iconWrapper}>
        <Languages size={48} />
      </div>
      <h1 className={styles.title}>{t('onboarding.language_title')}</h1>
      <p className={styles.subtitle}>{t('onboarding.language_desc')}</p>
      <div className={styles.langList}>
        {APP_UI_LANGUAGE_ORDER.map((lang) => {
          const active = selectedLanguage === lang
          return (
            <button
              key={lang}
              type="button"
              className={`${styles.langChip} ${active ? styles.langChipActive : ''}`}
              onClick={() => onSelectLanguage(lang)}
            >
              <span>{getLanguageLabel(lang)}</span>
              {active ? <span className={styles.checkMark}>✓</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
