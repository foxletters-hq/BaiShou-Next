import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './SummarySettingsView.module.css'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import { CodeMirrorEditor } from '../DiaryEditor/CodeMirrorEditor'
import { Switch } from '../Switch/Switch'
import { Modal } from '../Modal/Modal'
import { resolveDesktopAssistantAvatarSrc } from '../assistant-avatar.util'
import '../DiaryEditor/DiaryEditor.css'
import seg from '../shared/SegmentedControl.module.css'
import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS,
  getDefaultCustomGenerationSystemPrompt,
  getSummaryTemplateForEdit,
  SHARED_MEMORY_LOOKBACK_SLIDER_BASE,
  SHARED_MEMORY_LOOKBACK_MIN,
  SUMMARY_PROMPT_LOCALE_OPTIONS,
  type SummaryGenerationMode,
  type SummaryPromptLocale,
  type SummaryTemplateKey,
  type SummaryTemplatesMap
} from '@baishou/shared'

export interface SummarySettingsAssistantOption {
  id: string
  name: string
  avatarPath?: string
}

export interface SummaryInstructionsConfig {
  monthlySummarySource: 'weeklies' | 'diaries'
  promptLocale: SummaryPromptLocale
  instructionsByLocale: Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>>
  customGenerationSystemPromptByLocale: Partial<Record<SummaryPromptLocale, string>>
  generationMode: SummaryGenerationMode
  generationAssistantId?: string
  injectSharedMemoryBeforeGenerate: boolean
  sharedMemoryLookbackMonths: number
}

export type SummarySettingsChangeOptions = {
  /** Only Save / Restore default should persist generation templates. */
  includeTemplates?: boolean
}

export interface SummarySettingsViewProps {
  config: SummaryInstructionsConfig
  assistants?: SummarySettingsAssistantOption[]
  onChange: (config: SummaryInstructionsConfig, options?: SummarySettingsChangeOptions) => void
  onResetTemplate?: (type: SummaryTemplateKey, locale: SummaryPromptLocale) => string
}

export const SummarySettingsView: React.FC<SummarySettingsViewProps> = ({
  config,
  assistants = [],
  onChange,
  onResetTemplate
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<SummaryTemplateKey>('weekly')
  const [activePromptLocale, setActivePromptLocale] = useState<SummaryPromptLocale>(
    config.promptLocale
  )
  const [draftTemplates, setDraftTemplates] = useState(config.instructionsByLocale)
  const [localText, setLocalText] = useState(() =>
    getSummaryTemplateForEdit(config.instructionsByLocale, config.promptLocale, activeTab)
  )
  const [localSystemPrompt, setLocalSystemPrompt] = useState(
    () =>
      config.customGenerationSystemPromptByLocale?.[config.promptLocale]?.trim() ||
      getDefaultCustomGenerationSystemPrompt(config.promptLocale)
  )
  const [resetKey, setResetKey] = useState(0)
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false)
  const systemPromptDirtyRef = useRef(false)
  const localSystemPromptRef = useRef(localSystemPrompt)
  const activePromptLocaleRef = useRef(activePromptLocale)
  const configRef = useRef(config)
  const onChangeRef = useRef(onChange)
  localSystemPromptRef.current = localSystemPrompt
  activePromptLocaleRef.current = activePromptLocale
  configRef.current = config
  onChangeRef.current = onChange

  const lookback = config.sharedMemoryLookbackMonths || DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS
  /** 拖动过程中只用本地值刷新 UI，避免每次 onChange 都走 IPC */
  const [lookbackDraft, setLookbackDraft] = useState(lookback)
  const lookbackDraftRef = useRef(lookback)
  const lookbackDraggingRef = useRef(false)
  lookbackDraftRef.current = lookbackDraft
  const selectedPartner = assistants.find((a) => a.id === config.generationAssistantId)

  useEffect(() => {
    if (lookbackDraggingRef.current) return
    setLookbackDraft(lookback)
  }, [lookback])

  useEffect(() => {
    setDraftTemplates(config.instructionsByLocale)
  }, [config.instructionsByLocale])

  const patchLocaleTemplates = useCallback(
    (
      locale: SummaryPromptLocale,
      type: SummaryTemplateKey,
      text: string
    ): Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>> => ({
      ...draftTemplates,
      [locale]: {
        ...draftTemplates[locale],
        [type]: text
      }
    }),
    [draftTemplates]
  )

  const patchSystemPrompt = useCallback(
    (locale: SummaryPromptLocale, text: string): Partial<Record<SummaryPromptLocale, string>> => ({
      ...config.customGenerationSystemPromptByLocale,
      [locale]: text
    }),
    [config.customGenerationSystemPromptByLocale]
  )

  /** Persist non-template settings; always flush current system-prompt draft via refs. */
  const emitSettings = useCallback((patch: Partial<SummaryInstructionsConfig> = {}) => {
    const locale = activePromptLocaleRef.current
    const text = localSystemPromptRef.current
    const cfg = configRef.current
    systemPromptDirtyRef.current = false
    onChangeRef.current(
      {
        ...cfg,
        customGenerationSystemPromptByLocale: {
          ...cfg.customGenerationSystemPromptByLocale,
          [locale]: text
        },
        ...patch
      },
      { includeTemplates: false }
    )
  }, [])

  /** Typing / leave-page: don't rely only on blur (nav often skips it). */
  useEffect(() => {
    if (!systemPromptDirtyRef.current) return
    const timer = window.setTimeout(() => {
      emitSettings()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [localSystemPrompt, emitSettings])

  useEffect(() => {
    return () => {
      if (!systemPromptDirtyRef.current) return
      const locale = activePromptLocaleRef.current
      const text = localSystemPromptRef.current
      const cfg = configRef.current
      systemPromptDirtyRef.current = false
      onChangeRef.current(
        {
          ...cfg,
          customGenerationSystemPromptByLocale: {
            ...cfg.customGenerationSystemPromptByLocale,
            [locale]: text
          }
        },
        { includeTemplates: false }
      )
    }
  }, [])

  const handleTabChange = (tab: SummaryTemplateKey) => {
    const nextDraft = patchLocaleTemplates(activePromptLocale, activeTab, localText)
    setDraftTemplates(nextDraft)
    setActiveTab(tab)
    setLocalText(getSummaryTemplateForEdit(nextDraft, activePromptLocale, tab))
    setResetKey((prev) => prev + 1)
  }

  const handlePromptLocaleChange = (locale: SummaryPromptLocale) => {
    const nextDraft = patchLocaleTemplates(activePromptLocale, activeTab, localText)
    const customGenerationSystemPromptByLocale = patchSystemPrompt(
      activePromptLocale,
      localSystemPrompt
    )
    setDraftTemplates(nextDraft)
    setActivePromptLocale(locale)
    setLocalText(getSummaryTemplateForEdit(nextDraft, locale, activeTab))
    systemPromptDirtyRef.current = false
    setLocalSystemPrompt(
      customGenerationSystemPromptByLocale[locale]?.trim() ||
        getDefaultCustomGenerationSystemPrompt(locale)
    )
    setResetKey((prev) => prev + 1)
    onChange(
      {
        ...config,
        customGenerationSystemPromptByLocale
      },
      { includeTemplates: false }
    )
  }

  /** Follow general-settings language → auto-select matching prompt locale. */
  useEffect(() => {
    setActivePromptLocale(config.promptLocale)
    setLocalText(
      getSummaryTemplateForEdit(config.instructionsByLocale, config.promptLocale, activeTab)
    )
    setLocalSystemPrompt(
      config.customGenerationSystemPromptByLocale?.[config.promptLocale]?.trim() ||
        getDefaultCustomGenerationSystemPrompt(config.promptLocale)
    )
    setResetKey((prev) => prev + 1)
    // Only react to generation-locale changes from general settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: activeTab kept as-is
  }, [config.promptLocale])

  const handleSave = () => {
    if (config.generationMode === 'assistant' && !config.generationAssistantId) {
      toast.showError(
        t(
          'settings.summary_generation_assistant_required',
          'Select a partner, or switch back to custom prompt mode'
        )
      )
      return
    }
    const instructionsByLocale = patchLocaleTemplates(activePromptLocale, activeTab, localText)
    setDraftTemplates(instructionsByLocale)
    onChange(
      {
        ...config,
        instructionsByLocale,
        customGenerationSystemPromptByLocale: patchSystemPrompt(
          activePromptLocale,
          localSystemPrompt
        )
      },
      { includeTemplates: true }
    )
    toast.showSuccess(t('settings.saved', 'Saved'))
  }

  const handleReset = () => {
    if (!onResetTemplate) return
    const defaultText = onResetTemplate(activeTab, activePromptLocale)
    setLocalText(defaultText)
    setResetKey((prev) => prev + 1)
    const instructionsByLocale = patchLocaleTemplates(activePromptLocale, activeTab, defaultText)
    setDraftTemplates(instructionsByLocale)
    onChange(
      {
        ...config,
        instructionsByLocale,
        customGenerationSystemPromptByLocale: patchSystemPrompt(
          activePromptLocale,
          localSystemPrompt
        )
      },
      { includeTemplates: true }
    )
    toast.show(t('summary.reset_template_success', 'Default template restored'))
  }

  const handleResetSystemPrompt = () => {
    const defaultText = getDefaultCustomGenerationSystemPrompt(activePromptLocale)
    systemPromptDirtyRef.current = false
    setLocalSystemPrompt(defaultText)
    onChange(
      {
        ...config,
        customGenerationSystemPromptByLocale: patchSystemPrompt(activePromptLocale, defaultText)
      },
      { includeTemplates: false }
    )
    toast.show(t('summary.reset_template_success', 'Default template restored'))
  }

  const previewLookback = (raw: number) => {
    const next = clampSharedMemoryLookbackMonths(raw)
    setLookbackDraft(next)
  }

  const commitLookback = useCallback(
    (raw?: number) => {
      lookbackDraggingRef.current = false
      const next = clampSharedMemoryLookbackMonths(
        raw === undefined ? lookbackDraftRef.current : raw
      )
      setLookbackDraft(next)
      if (next === configRef.current.sharedMemoryLookbackMonths) return
      emitSettings({ sharedMemoryLookbackMonths: next })
    },
    [emitSettings]
  )

  const tabs = useMemo(
    () =>
      [
        { id: 'weekly' as const, label: t('summary.tab_weekly', 'Weekly') },
        { id: 'monthly' as const, label: t('summary.tab_monthly', 'Monthly') },
        { id: 'quarterly' as const, label: t('summary.tab_quarterly', 'Quarterly') },
        { id: 'yearly' as const, label: t('summary.tab_yearly', 'Yearly') }
      ] as const,
    [t]
  )

  const activeLocaleLabel =
    SUMMARY_PROMPT_LOCALE_OPTIONS.find((l) => l.id === activePromptLocale)?.fallback ??
    activePromptLocale

  const sliderMax = Math.max(SHARED_MEMORY_LOOKBACK_SLIDER_BASE, lookbackDraft)
  const sliderPct =
    ((lookbackDraft - SHARED_MEMORY_LOOKBACK_MIN) * 100) /
    Math.max(1, sliderMax - SHARED_MEMORY_LOOKBACK_MIN)

  const renderPartnerAvatar = (assistant?: SummarySettingsAssistantOption) => {
    const src = resolveDesktopAssistantAvatarSrc(assistant?.avatarPath)
    return (
      <span
        className={styles.partnerAvatar}
        aria-hidden
        style={{ backgroundImage: `url("${src}")` }}
      />
    )
  }

  return (
    <SettingsPageChrome title={t('settings.summary_settings_title', '回忆生成设置')}>
      <div className={styles.container}>
        <div className={styles.pageCard}>
          <div className={styles.section}>
            <div className={styles.cardTitleLine}>
              <span>{t('settings.summary_generation_mode_title', 'Generation mode')}</span>
            </div>
            <p className={styles.cardDesc}>
              {t(
                'settings.summary_generation_mode_desc',
                'Write a custom generation-assistant prompt, or reuse a partner’s persona. Both modes use the global summary model.'
              )}
            </p>
            <div className={seg.group}>
              <button
                type="button"
                className={`${seg.btn} ${config.generationMode === 'prompt' ? seg.btnActive : ''}`}
                onClick={() => emitSettings({ generationMode: 'prompt' })}
              >
                {t('settings.summary_generation_mode_prompt', 'Custom prompt')}
              </button>
              <button
                type="button"
                className={`${seg.btn} ${config.generationMode === 'assistant' ? seg.btnActive : ''}`}
                onClick={() => {
                  if (assistants.length === 0) {
                    toast.showError(
                      t(
                        'settings.summary_generation_assistant_required',
                        'Select a partner, or switch back to custom prompt mode'
                      )
                    )
                    return
                  }
                  const nextId =
                    config.generationAssistantId &&
                    assistants.some((a) => a.id === config.generationAssistantId)
                      ? config.generationAssistantId
                      : assistants[0]!.id
                  emitSettings({
                    generationMode: 'assistant',
                    generationAssistantId: nextId
                  })
                }}
              >
                {t('settings.summary_generation_mode_assistant', 'Reuse partner')}
              </button>
            </div>

            {config.generationMode === 'prompt' && (
              <div className={styles.systemPromptBlock}>
                <div className={styles.subsectionTitle}>
                  {t('settings.summary_custom_system_prompt_title', 'Generation assistant prompt')}
                </div>
                <p className={styles.cardDesc}>
                  {t(
                    'settings.summary_custom_system_prompt_desc',
                    'System prompt for the summary-writing assistant in custom prompt mode. Empty falls back to the built-in default.'
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
                <textarea
                  className={styles.systemPromptArea}
                  value={localSystemPrompt}
                  onChange={(e) => {
                    systemPromptDirtyRef.current = true
                    setLocalSystemPrompt(e.target.value)
                  }}
                  onBlur={() => emitSettings()}
                  rows={8}
                  placeholder={t(
                    'settings.summary_custom_system_prompt_hint',
                    'e.g. You are a warm memory companion who writes concise, faithful summaries…'
                  )}
                />
                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.resetBtn}
                    onClick={handleResetSystemPrompt}
                  >
                    {t('settings.restore_default', 'Restore default')}
                  </button>
                </div>
              </div>
            )}

            {config.generationMode === 'assistant' && (
              <div className={styles.assistantPickRow}>
                <div className={styles.subsectionTitle}>
                  {t('settings.summary_generation_assistant_label', 'Summary generation partner')}
                </div>
                <button
                  type="button"
                  className={styles.partnerCard}
                  onClick={() => setPartnerPickerOpen(true)}
                >
                  {renderPartnerAvatar(selectedPartner)}
                  <span className={styles.partnerMeta}>
                    <span className={styles.partnerName}>
                      {selectedPartner?.name ||
                        t('settings.summary_generation_assistant_placeholder', 'Choose a partner')}
                    </span>
                    <span className={styles.partnerHint}>
                      {t('settings.summary_generation_partner_change', 'Tap to change')}
                    </span>
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.injectRow}>
              <div className={styles.injectText}>
                <div className={styles.subsectionTitle}>
                  {t(
                    'settings.summary_inject_shared_memory',
                    'Inject shared memory before generation'
                  )}
                </div>
                <p className={styles.cardDesc}>
                  {t(
                    'settings.summary_inject_shared_memory_desc',
                    'When on, shared memory from the months before this period is inserted between the template and this period’s raw data for continuity.'
                  )}
                </p>
              </div>
              <Switch
                checked={config.injectSharedMemoryBeforeGenerate}
                onChange={(e) =>
                  emitSettings({
                    injectSharedMemoryBeforeGenerate: e.target.checked
                  })
                }
              />
            </div>

            {config.injectSharedMemoryBeforeGenerate && (
              <div className={styles.lookbackSliderBlock}>
                <div className={styles.lookbackLabelRow}>
                  <label className={styles.fieldLabel} htmlFor="summary-inject-lookback">
                    {t('settings.summary_inject_lookback_label', 'Lookback months')}
                  </label>
                  <input
                    id="summary-inject-lookback"
                    type="number"
                    min={SHARED_MEMORY_LOOKBACK_MIN}
                    className={styles.lookbackInput}
                    value={lookbackDraft}
                    onChange={(e) => previewLookback(Number(e.target.value))}
                    onBlur={() => commitLookback()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      }
                    }}
                  />
                </div>
                <div className={styles.lookbackSliderContainer}>
                  <input
                    type="range"
                    min={SHARED_MEMORY_LOOKBACK_MIN}
                    max={sliderMax}
                    step={1}
                    value={Math.min(lookbackDraft, sliderMax)}
                    onChange={(e) => {
                      lookbackDraggingRef.current = true
                      previewLookback(Number(e.target.value))
                    }}
                    onPointerUp={() => commitLookback()}
                    onMouseUp={() => commitLookback()}
                    onTouchEnd={() => commitLookback()}
                    onKeyUp={(e) => {
                      if (
                        e.key === 'ArrowLeft' ||
                        e.key === 'ArrowRight' ||
                        e.key === 'Home' ||
                        e.key === 'End' ||
                        e.key === 'PageUp' ||
                        e.key === 'PageDown'
                      ) {
                        commitLookback()
                      }
                    }}
                    className={styles.lookbackSlider}
                    style={{ backgroundSize: `${sliderPct}% 100%` }}
                    aria-label={t('settings.summary_inject_lookback_label', 'Lookback months')}
                  />
                </div>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.cardTitleLine}>
              <span>{t('settings.summary_data_sources_title', 'What each summary reads')}</span>
            </div>
            <p className={styles.cardDesc}>
              {t(
                'settings.summary_data_sources_desc',
                'When generating each type of summary, BaiShou reads the following sources for that period.'
              )}
            </p>
            <ul className={styles.dataSourceList}>
              <li>{t('settings.summary_data_source_weekly', 'Weekly: diaries within that week')}</li>
              <li>
                {t(
                  'settings.summary_data_source_monthly',
                  'Monthly: always reads this month’s weeklies; the switch below adds this month’s diaries'
                )}
              </li>
              <li>
                {t(
                  'settings.summary_data_source_quarterly',
                  'Quarterly: monthly summaries in that quarter'
                )}
              </li>
              <li>
                {t(
                  'settings.summary_data_source_yearly',
                  'Yearly: quarterly summaries in that year'
                )}
              </li>
            </ul>

            <div className={styles.cardTitleLine}>
              <span>{t('settings.monthly_summary_data_source', 'Monthly summary data source')}</span>
            </div>
            <p className={styles.cardDesc}>
              {t(
                'settings.monthly_summary_data_source_desc',
                'Both options read this month’s weeklies; optionally also include this month’s diaries for more detail'
              )}
            </p>

            <div className={seg.group}>
              <button
                type="button"
                className={`${seg.btn} ${config.monthlySummarySource === 'weeklies' ? seg.btnActive : ''}`}
                onClick={() => emitSettings({ monthlySummarySource: 'weeklies' })}
              >
                {t('settings.read_only_weeklies', 'Weeklies only')}
              </button>
              <button
                type="button"
                className={`${seg.btn} ${config.monthlySummarySource === 'diaries' ? seg.btnActive : ''}`}
                onClick={() => emitSettings({ monthlySummarySource: 'diaries' })}
              >
                {t('settings.read_all_diaries', 'Weeklies + diaries')}
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.cardTitleLine}>
              <span>
                {t('settings.summary_generation_templates_title', 'Summary generation templates')}
              </span>
            </div>
            <p className={styles.cardDesc}>
              {t(
                'settings.summary_generation_templates_desc',
                'User-side templates for weekly, monthly, quarterly and yearly summaries. Customize per language below.'
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

            <div className={`${seg.group} ${seg.groupStretch} ${seg.groupSpaced}`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`${seg.btn} ${activeTab === tab.id ? seg.btnActive : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
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

        <Modal
          isOpen={partnerPickerOpen}
          onClose={() => setPartnerPickerOpen(false)}
          title={t('settings.summary_generation_assistant_placeholder', 'Choose a partner')}
          closeOnOverlayClick
        >
          <div className={styles.partnerPickerList}>
            {assistants.length === 0 ? (
              <p className={styles.cardDesc}>
                {t(
                  'settings.summary_generation_assistant_required',
                  'Create a partner first, then come back.'
                )}
              </p>
            ) : (
              assistants.map((a) => {
                const active = a.id === config.generationAssistantId
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`${styles.partnerPickerItem} ${active ? styles.partnerPickerItemActive : ''}`}
                    onClick={() => {
                      emitSettings({
                        generationMode: 'assistant',
                        generationAssistantId: a.id
                      })
                      setPartnerPickerOpen(false)
                    }}
                  >
                    {renderPartnerAvatar(a)}
                    <span className={styles.partnerName}>{a.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </Modal>
      </div>
    </SettingsPageChrome>
  )
}
