import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './SummarySettingsView.module.css'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import { CodeMirrorEditor } from '../DiaryEditor/CodeMirrorEditor'
import '../DiaryEditor/DiaryEditor.css'
import {
  getSummaryTemplateForEdit,
  SUMMARY_PROMPT_LOCALE_OPTIONS,
  type SummaryPromptLocale,
  type SummaryTemplateKey,
  type SummaryTemplatesMap
} from '@baishou/shared'

export interface SummaryInstructionsConfig {
  monthlySummarySource: 'weeklies' | 'diaries'
  promptLocale: SummaryPromptLocale
  instructionsByLocale: Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>>
}

export interface SummarySettingsViewProps {
  config: SummaryInstructionsConfig
  onChange: (config: SummaryInstructionsConfig) => void
  onResetTemplate?: (type: SummaryTemplateKey, locale: SummaryPromptLocale) => string
}

export const SummarySettingsView: React.FC<SummarySettingsViewProps> = ({
  config,
  onChange,
  onResetTemplate
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<SummaryTemplateKey>('weekly')
  const [activePromptLocale, setActivePromptLocale] = useState<SummaryPromptLocale>(
    config.promptLocale
  )
  const [localText, setLocalText] = useState(() =>
    getSummaryTemplateForEdit(config.instructionsByLocale, config.promptLocale, activeTab)
  )
  const [resetKey, setResetKey] = useState(0)

  const readTemplate = useCallback(
    (locale: SummaryPromptLocale, type: SummaryTemplateKey) =>
      getSummaryTemplateForEdit(config.instructionsByLocale, locale, type),
    [config.instructionsByLocale]
  )

  const patchLocaleTemplates = useCallback(
    (
      locale: SummaryPromptLocale,
      type: SummaryTemplateKey,
      text: string
    ): Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>> => ({
      ...config.instructionsByLocale,
      [locale]: {
        ...config.instructionsByLocale[locale],
        [type]: text
      }
    }),
    [config.instructionsByLocale]
  )

  const flushLocalToConfig = useCallback(
    (locale: SummaryPromptLocale, type: SummaryTemplateKey, text: string) => {
      onChange({
        ...config,
        instructionsByLocale: patchLocaleTemplates(locale, type, text)
      })
    },
    [config, onChange, patchLocaleTemplates]
  )

  const handleTabChange = (tab: SummaryTemplateKey) => {
    flushLocalToConfig(activePromptLocale, activeTab, localText)
    setActiveTab(tab)
    setLocalText(readTemplate(activePromptLocale, tab))
    setResetKey((prev) => prev + 1)
  }

  const handlePromptLocaleChange = (locale: SummaryPromptLocale) => {
    const instructionsByLocale = patchLocaleTemplates(activePromptLocale, activeTab, localText)
    setActivePromptLocale(locale)
    setLocalText(getSummaryTemplateForEdit(instructionsByLocale, locale, activeTab))
    setResetKey((prev) => prev + 1)
    onChange({
      ...config,
      instructionsByLocale
    })
  }

  /** Follow general-settings language → auto-select matching prompt locale. */
  useEffect(() => {
    setActivePromptLocale(config.promptLocale)
    setLocalText(
      getSummaryTemplateForEdit(config.instructionsByLocale, config.promptLocale, activeTab)
    )
    setResetKey((prev) => prev + 1)
  }, [config.promptLocale])

  const handleSave = () => {
    const instructionsByLocale = patchLocaleTemplates(activePromptLocale, activeTab, localText)
    onChange({
      ...config,
      instructionsByLocale
    })
    toast.showSuccess(t('settings.saved', 'Saved'))
  }

  const handleReset = () => {
    if (!onResetTemplate) return
    const defaultText = onResetTemplate(activeTab, activePromptLocale)
    setLocalText(defaultText)
    setResetKey((prev) => prev + 1)
    onChange({
      ...config,
      instructionsByLocale: patchLocaleTemplates(activePromptLocale, activeTab, defaultText)
    })
    toast.show(t('summary.reset_template_success', 'Default template restored'))
  }

  const tabs = useMemo(
    () =>
      [
        { id: 'weekly' as const, icon: '🌱', label: t('summary.tab_weekly', 'Weekly') },
        { id: 'monthly' as const, icon: '☘️', label: t('summary.tab_monthly', 'Monthly') },
        { id: 'quarterly' as const, icon: '🪴', label: t('summary.tab_quarterly', 'Quarterly') },
        { id: 'yearly' as const, icon: '🌳', label: t('summary.tab_yearly', 'Yearly') }
      ] as const,
    [t]
  )

  const activeLocaleLabel =
    SUMMARY_PROMPT_LOCALE_OPTIONS.find((l) => l.id === activePromptLocale)?.fallback ??
    activePromptLocale

  return (
    <div className={styles.container}>
      <div className={styles.cardSection}>
        <div className={styles.cardTitleLine}>
          <span>📥 {t('settings.monthly_summary_data_source', 'Monthly summary data source')}</span>
        </div>
        <p className={styles.cardDesc}>
          {t(
            'settings.monthly_summary_data_source_desc',
            'Choose how underlying facts are gathered for long-cycle AI summaries.'
          )}
        </p>

        <div className={styles.btnGroup}>
          <button
            className={`${styles.segBtn} ${config.monthlySummarySource === 'weeklies' ? styles.active : ''}`}
            onClick={() => onChange({ ...config, monthlySummarySource: 'weeklies' })}
          >
            <span>📅</span>{' '}
            {t('settings.read_only_weeklies', 'Aggregate weekly summaries only (faster)')}
          </button>
          <button
            className={`${styles.segBtn} ${config.monthlySummarySource === 'diaries' ? styles.active : ''}`}
            onClick={() => onChange({ ...config, monthlySummarySource: 'diaries' })}
          >
            <span>📄</span> {t('settings.read_all_diaries', 'Read all diary entries (higher fidelity)')}
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.cardTitleLine}>
          <span>
            📝 {t('settings.summary_ai_prompt_title', 'AI summary prompt templates')}
          </span>
        </div>
        <p className={styles.cardDesc}>
          {t(
            'settings.summary_ai_prompt_desc',
            'System prompts used when BaiShou runs automated weekly, monthly, quarterly and yearly summaries. Customize per language below.'
          )}
        </p>

        <p className={styles.localeHint}>
          {t('settings.summary_prompt_locale_hint', 'Prompt language for generation')}:{' '}
          <strong>
            {SUMMARY_PROMPT_LOCALE_OPTIONS.find((l) => l.id === config.promptLocale)?.fallback ??
              config.promptLocale}
          </strong>
          {activePromptLocale !== config.promptLocale && (
            <>
              {' · '}
              {t('settings.summary_prompt_editing_locale', 'Editing')}: {activeLocaleLabel}
            </>
          )}
          {' · '}
          {t(
            'settings.summary_prompt_generation_locale',
            'Summaries use templates under “Generation language” unless you change it when saving.'
          )}
        </p>

        <div className={styles.langBar}>
          {SUMMARY_PROMPT_LOCALE_OPTIONS.map((lang) => (
            <button
              key={lang.id}
              type="button"
              className={`${styles.langChip} ${activePromptLocale === lang.id ? styles.langChipActive : ''} ${config.promptLocale === lang.id ? styles.langChipGeneration : ''}`}
              onClick={() => handlePromptLocaleChange(lang.id)}
            >
              {t(lang.labelKey, lang.fallback)}
            </button>
          ))}
        </div>

        <div className={styles.tabBar}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.textAreaWrapper}>
          <div className={styles.milkdownContainer}>
            <CodeMirrorEditor
              key={`${activePromptLocale}-${activeTab}-${resetKey}`}
              content={localText}
              onChange={(val) => setLocalText(val || '')}
              placeholder={t(
                'settings.summary_ai_prompt_hint',
                'Write guidelines for AI when extracting and generating summaries...'
              )}
            />
          </div>
          <div className={styles.actionsRow}>
            <button type="button" className={styles.resetBtn} onClick={handleReset}>
              {t('settings.restore_default', 'Restore default')}
            </button>
            <button type="button" className={styles.saveBtn} onClick={handleSave}>
              {t('common.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
