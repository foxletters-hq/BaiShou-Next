import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './SummarySettingsView.module.css'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import stack from '../shared/SettingsStack.module.css'
import { HelpTooltip } from '../HelpTooltip'
import { Switch } from '../Switch/Switch'
import { Modal } from '../Modal/Modal'
import { resolveDesktopAssistantAvatarSrc } from '../assistant-avatar.util'
import { SegmentedControl } from '../shared/SegmentedControl'
import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS,
  getDefaultCustomGenerationSystemPrompt,
  getSummaryTemplateForEdit,
  SHARED_MEMORY_LOOKBACK_SLIDER_BASE,
  SHARED_MEMORY_LOOKBACK_MIN,
  SUMMARY_PROMPT_LOCALE_OPTIONS,
  type SharedMemoryCopyPreview,
  type SummaryGenerationMode,
  type SummaryPromptLocale,
  type SummaryTemplateKey,
  type SummaryTemplatesMap
} from '@baishou/shared'
import { Loader2 } from 'lucide-react'
import { formatCompactTokenCount } from '../../shared/token-usage-display'
import '../DashboardSharedMemoryCard/DashboardSharedMemoryCard.css'

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
  const injectEnabled = config.injectSharedMemoryBeforeGenerate
  const [injectPreview, setInjectPreview] = useState<SharedMemoryCopyPreview | null>(null)
  const [injectPreviewLoading, setInjectPreviewLoading] = useState(false)

  useEffect(() => {
    if (lookbackDraggingRef.current) return
    setLookbackDraft(lookback)
  }, [lookback])

  useEffect(() => {
    if (!injectEnabled) {
      setInjectPreview(null)
      setInjectPreviewLoading(false)
      return undefined
    }

    let cancelled = false
    setInjectPreviewLoading(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const api = (window as Window & {
            api?: {
              summary?: {
                buildSharedContextPreview?: (
                  months: number
                ) => Promise<SharedMemoryCopyPreview | null>
              }
              rag?: {
                buildSharedContextPreview?: (
                  months: number
                ) => Promise<SharedMemoryCopyPreview | null>
              }
            }
          }).api
          const preview =
            (await api?.summary?.buildSharedContextPreview?.(lookbackDraft)) ??
            (await api?.rag?.buildSharedContextPreview?.(lookbackDraft)) ??
            null
          if (!cancelled) setInjectPreview(preview)
        } catch {
          if (!cancelled) setInjectPreview(null)
        } finally {
          if (!cancelled) setInjectPreviewLoading(false)
        }
      })()
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [injectEnabled, lookbackDraft])

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
      <div className={stack.stack}>
        <div className={stack.stackGroup}>
          <div className={stack.sectionLabelRow}>
            <h3 className={stack.sectionLabel}>
              {t('settings.summary_generation_mode_title', 'Generation mode')}
            </h3>
            <HelpTooltip
              size={14}
              content={t(
                'settings.summary_generation_mode_desc',
                'Write a custom generation-assistant prompt, or reuse a partner’s persona. Both modes use the global summary model.'
              )}
            />
          </div>
          <section className={stack.cardSection}>
            <div className={styles.sectionBody}>
              <SegmentedControl
                value={config.generationMode}
                options={[
                  {
                    value: 'prompt',
                    label: t('settings.summary_generation_mode_prompt', 'Custom prompt')
                  },
                  {
                    value: 'assistant',
                    label: t('settings.summary_generation_mode_assistant', 'Reuse partner')
                  }
                ]}
                onChange={(generationMode) => {
                  if (generationMode === 'prompt') {
                    emitSettings({ generationMode: 'prompt' })
                    return
                  }
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
              />

              {config.generationMode === 'prompt' && (
                <div className={styles.systemPromptBlock}>
                  <div className={styles.subsectionTitleRow}>
                    <div className={styles.subsectionTitle}>
                      {t(
                        'settings.summary_custom_system_prompt_title',
                        'Generation assistant prompt'
                      )}
                    </div>
                    <HelpTooltip
                      size={14}
                      content={t(
                        'settings.summary_custom_system_prompt_desc',
                        'System prompt for the summary-writing assistant in custom prompt mode. Empty falls back to the built-in default.'
                      )}
                    />
                  </div>
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
                  <p className={styles.localeHint}>
                    {t('settings.summary_prompt_locale_hint', '正在编辑提示词语言')}:{' '}
                    <strong>{activeLocaleLabel}</strong>
                  </p>
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
                    <button
                      type="button"
                      className={styles.saveBtn}
                      onClick={() => {
                        emitSettings()
                        toast.showSuccess(t('settings.saved', 'Saved'))
                      }}
                    >
                      {t('common.save', 'Save')}
                    </button>
                  </div>
                </div>
              )}

              {config.generationMode === 'assistant' && (
                <div className={styles.assistantPickRow}>
                  <div className={styles.subsectionTitle}>
                    {t(
                      'settings.summary_generation_assistant_label',
                      'Summary generation partner'
                    )}
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
                          t(
                            'settings.summary_generation_assistant_placeholder',
                            'Choose a partner'
                          )}
                      </span>
                      <span className={styles.partnerHint}>
                        {t('settings.summary_generation_partner_change', 'Tap to change')}
                      </span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className={stack.stackGroup}>
          <div className={stack.sectionLabelRow}>
            <h3 className={stack.sectionLabel}>
              {t('settings.summary_inject_shared_memory', 'Inject shared memory before generation')}
            </h3>
            <HelpTooltip
              size={14}
              content={t(
                'settings.summary_inject_shared_memory_desc',
                'When on, shared memory from the months before this period is inserted between the template and this period’s raw data for continuity.'
              )}
            />
          </div>
          <section className={stack.cardSection}>
            <div className={styles.injectToggleRow}>
              <span className={styles.injectToggleLabel}>
                {t('settings.summary_inject_enabled', '开启注入')}
              </span>
              <Switch
                size="sm"
                checked={injectEnabled}
                onChange={(e) =>
                  emitSettings({
                    injectSharedMemoryBeforeGenerate: e.target.checked
                  })
                }
                aria-label={t('settings.summary_inject_enabled', '开启注入')}
              />
            </div>

            {injectEnabled && (
              <>
                <div className={styles.injectDivider} />
                <div className={styles.injectBody}>
                  <div className="sm-controls" style={{ marginBottom: 0 }}>
                    <div className="sm-label-row">
                      <label className={styles.injectLookbackLabel} htmlFor="summary-inject-lookback">
                        {t('settings.summary_inject_lookback_label', '回溯月数')}
                      </label>
                      <input
                        id="summary-inject-lookback"
                        type="number"
                        min={SHARED_MEMORY_LOOKBACK_MIN}
                        className="sm-number-input"
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
                    <div className="sm-slider-container">
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
                        className="sm-slider"
                        style={{ backgroundSize: `${sliderPct}% 100%` }}
                        aria-label={t('settings.summary_inject_lookback_label', '回溯月数')}
                      />
                    </div>
                  </div>

                  {injectPreviewLoading && !injectPreview ? (
                    <div className="sm-preview sm-previewLoading">
                      <Loader2 size={14} className="sm-previewSpinner" />
                      <span>
                        {t('settings.summary_inject_preview_loading', '正在统计预计发送内容…')}
                      </span>
                    </div>
                  ) : injectPreview ? (
                    <div className="sm-preview" style={{ marginBottom: 0 }}>
                      <div className="sm-previewTitle">
                        {t('settings.summary_inject_preview_title', '预计发送内容')}
                        {injectPreviewLoading ? (
                          <Loader2 size={12} className="sm-previewSpinnerInline" />
                        ) : null}
                      </div>
                      {injectPreview.total === 0 ? (
                        <p className="sm-previewEmpty">
                          {t(
                            'summary.copy_preview_empty',
                            '当前回溯范围内暂无可复制内容'
                          )}
                        </p>
                      ) : (
                        <>
                          <div className="sm-previewChips">
                            {(
                              [
                                {
                                  key: 'diary',
                                  label: t('summary.copy_preview_diary', '日记'),
                                  count: injectPreview.diary
                                },
                                {
                                  key: 'yearly',
                                  label: t('summary.copy_preview_yearly', '年总结'),
                                  count: injectPreview.yearly
                                },
                                {
                                  key: 'quarterly',
                                  label: t('summary.copy_preview_quarterly', '季度总结'),
                                  count: injectPreview.quarterly
                                },
                                {
                                  key: 'monthly',
                                  label: t('summary.copy_preview_monthly', '月总结'),
                                  count: injectPreview.monthly
                                },
                                {
                                  key: 'weekly',
                                  label: t('summary.copy_preview_weekly', '周总结'),
                                  count: injectPreview.weekly
                                }
                              ] as const
                            )
                              .filter((item) => item.count > 0)
                              .map((item) => (
                                <span key={item.key} className="sm-previewChip">
                                  {item.label} {item.count}
                                  {t('summary.copy_preview_unit', '篇')}
                                </span>
                              ))}
                          </div>
                          <p className="sm-previewTotal">
                            {t('summary.copy_preview_total', '共 {{count}} 项', {
                              count: injectPreview.total
                            })}
                          </p>
                          <p className="sm-previewSize">
                            {t(
                              'summary.copy_preview_estimated_size',
                              '约 {{chars}} 字 · 约 {{tokens}} tokens',
                              {
                                chars: injectPreview.estimatedChars.toLocaleString(),
                                tokens: formatCompactTokenCount(injectPreview.estimatedTokens)
                              }
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>

        <div className={stack.stackGroup}>
          <div className={stack.sectionLabelRow}>
            <h3 className={stack.sectionLabel}>
              {t('settings.summary_data_sources_title', 'What each summary reads')}
            </h3>
            <HelpTooltip
              size={14}
              content={t(
                'settings.summary_data_sources_desc',
                'When generating each type of summary, BaiShou reads the following sources for that period.'
              )}
            />
          </div>
          <section className={stack.cardSection}>
            <div className={styles.sectionBody}>
              <ul className={styles.dataSourceList}>
                <li>
                  {t('settings.summary_data_source_weekly', 'Weekly: diaries within that week')}
                </li>
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
            </div>
            <div className={stack.divider} />
            <div className={styles.sectionBody}>
              <div className={styles.subsectionTitleRow}>
                <div className={styles.subsectionTitle}>
                  {t('settings.monthly_summary_data_source', 'Monthly summary data source')}
                </div>
                <HelpTooltip
                  size={14}
                  content={t(
                    'settings.monthly_summary_data_source_desc',
                    'Both options read this month’s weeklies; optionally also include this month’s diaries for more detail'
                  )}
                />
              </div>
              <SegmentedControl
                value={config.monthlySummarySource}
                options={[
                  {
                    value: 'weeklies',
                    label: t('settings.read_only_weeklies', 'Weeklies only')
                  },
                  {
                    value: 'diaries',
                    label: t('settings.read_all_diaries', 'Weeklies + diaries')
                  }
                ]}
                onChange={(monthlySummarySource) => emitSettings({ monthlySummarySource })}
              />
            </div>
          </section>
        </div>

        <div className={stack.stackGroup}>
          <div className={stack.sectionLabelRow}>
            <h3 className={stack.sectionLabel}>
              {t('settings.summary_generation_templates_title', 'Summary generation templates')}
            </h3>
            <HelpTooltip
              size={14}
              content={t(
                'settings.summary_generation_templates_desc',
                'User-side templates for weekly, monthly, quarterly and yearly summaries. Customize per language below.'
              )}
            />
          </div>
          <section className={stack.cardSection}>
            <div className={styles.sectionBody}>
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
              <p className={styles.localeHint}>
                {t('settings.summary_prompt_editing_locale', '正在编辑模板语言')}:{' '}
                <strong>{activeLocaleLabel}</strong>
              </p>
              <p className={styles.localeHintMeta}>
                {t(
                  'settings.summary_prompt_generation_locale',
                  '自动生成总结时使用「常规设置」所选语言的模板。'
                )}
              </p>

              <SegmentedControl
                stretch
                spaced
                value={activeTab}
                options={tabs.map((tab) => ({
                  value: tab.id,
                  label: tab.label
                }))}
                onChange={handleTabChange}
              />

              <div className={styles.textAreaWrapper}>
                <textarea
                  className={styles.systemPromptArea}
                  value={localText}
                  onChange={(e) => setLocalText(e.target.value)}
                  rows={8}
                  placeholder={t(
                    'settings.summary_ai_prompt_hint',
                    'Write guidelines for AI when extracting and generating summaries...'
                  )}
                />
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
          </section>
        </div>

        <Modal
          isOpen={partnerPickerOpen}
          onClose={() => setPartnerPickerOpen(false)}
          title={t('settings.summary_generation_assistant_placeholder', 'Choose a partner')}
          closeOnOverlayClick
        >
          <div className={styles.partnerPickerList}>
            {assistants.length === 0 ? (
              <p className={styles.emptyHint}>
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
