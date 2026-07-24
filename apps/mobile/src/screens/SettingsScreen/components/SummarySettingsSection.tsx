/* eslint-disable max-lines -- 总结设置：模板/模型/批量任务同页 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS,
  getDefaultCustomGenerationSystemPrompt,
  getDefaultSummaryTemplate,
  getSummaryTemplateForEdit,
  normalizeSummaryGenerationMode,
  resolveSummaryPromptLocale,
  SHARED_MEMORY_LOOKBACK_SLIDER_BASE,
  SHARED_MEMORY_LOOKBACK_MIN,
  SUMMARY_PROMPT_LOCALE_OPTIONS,
  type SummaryConfig,
  type SummaryGenerationMode,
  type SummaryPromptLocale,
  type SummaryTemplateKey
} from '@baishou/shared'
import { useNativeTheme, useNativeToast, Input, Switch, NativeSlider } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { resolveAppUiLanguage } from '../../../lib/device-locale'
import { listAssistantsForUi } from '../../../lib/mobile-assistant.util'
import { SettingsGroupCard } from './SettingsGroupCard'

const TEMPLATE_KEYS: SummaryTemplateKey[] = ['weekly', 'monthly', 'quarterly', 'yearly']

const TAB_META: Record<SummaryTemplateKey, { icon: string; labelKey: string }> = {
  weekly: { icon: '🌱', labelKey: 'summary.tab_weekly' },
  monthly: { icon: '☘️', labelKey: 'summary.tab_monthly' },
  quarterly: { icon: '🪴', labelKey: 'summary.tab_quarterly' },
  yearly: { icon: '🌳', labelKey: 'summary.tab_yearly' }
}

export const SummarySettingsSection: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()

  const [summaryConfig, setSummaryConfig] = useState<SummaryConfig>({})
  const [activeTab, setActiveTab] = useState<SummaryTemplateKey>('weekly')
  const [activePromptLocale, setActivePromptLocale] = useState<SummaryPromptLocale>('zh')
  const [localText, setLocalText] = useState('')
  const [localSystemPrompt, setLocalSystemPrompt] = useState('')
  const [generationLocale, setGenerationLocale] = useState<SummaryPromptLocale>('zh')
  const [monthlySummarySource, setMonthlySummarySource] = useState<'weeklies' | 'diaries'>(
    'weeklies'
  )
  const [generationMode, setGenerationMode] = useState<SummaryGenerationMode>('prompt')
  const [generationAssistantId, setGenerationAssistantId] = useState<string | undefined>()
  const [injectSharedMemory, setInjectSharedMemory] = useState(false)
  const [lookbackMonths, setLookbackMonths] = useState(DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS)
  const [assistants, setAssistants] = useState<
    Array<{ id: string; name: string; avatarPath?: string; displayAvatarUri?: string }>
  >([])
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false)
  const activeTabRef = useRef<SummaryTemplateKey>(activeTab)
  activeTabRef.current = activeTab
  const persistChainRef = useRef(Promise.resolve())
  /** Last disk-persisted templates — auto-save must never overwrite with dirty drafts. */
  const persistedTemplatesRef = useRef(summaryConfig.instructionsByLocale)

  const lookbackMonthsRef = useRef(lookbackMonths)
  lookbackMonthsRef.current = lookbackMonths
  const localSystemPromptRef = useRef(localSystemPrompt)
  localSystemPromptRef.current = localSystemPrompt
  const activePromptLocaleRef = useRef(activePromptLocale)
  activePromptLocaleRef.current = activePromptLocale
  const summaryConfigRef = useRef(summaryConfig)
  summaryConfigRef.current = summaryConfig
  const systemPromptDirtyRef = useRef(false)
  const generationModeRef = useRef(generationMode)
  generationModeRef.current = generationMode
  const generationAssistantIdRef = useRef(generationAssistantId)
  generationAssistantIdRef.current = generationAssistantId
  const injectSharedMemoryRef = useRef(injectSharedMemory)
  injectSharedMemoryRef.current = injectSharedMemory
  const generationLocaleRef = useRef(generationLocale)
  generationLocaleRef.current = generationLocale
  const servicesRef = useRef(services)
  servicesRef.current = services
  const dbReadyRef = useRef(dbReady)
  dbReadyRef.current = dbReady

  const selectedPartner = assistants.find((a) => a.id === generationAssistantId)

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved = (await services.settingsManager.get<SummaryConfig>('summary_config')) || {}
      const settings = (await services.settingsManager.get<{ language?: string }>('settings')) || {}
      const uiLang = resolveAppUiLanguage(settings.language, i18n.language)
      const autoLocale = resolveSummaryPromptLocale(uiLang)
      setSummaryConfig(saved)
      persistedTemplatesRef.current = saved.instructionsByLocale
      setGenerationMode(normalizeSummaryGenerationMode(saved.generationMode))
      setGenerationAssistantId(saved.generationAssistantId)
      setInjectSharedMemory(!!saved.injectSharedMemoryBeforeGenerate)
      setLookbackMonths(
        clampSharedMemoryLookbackMonths(
          saved.sharedMemoryLookbackMonths ?? DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS
        )
      )
      const globalModels =
        (await services.settingsManager.get<{ monthlySummarySource?: 'weeklies' | 'diaries' }>(
          'global_models'
        )) || {}
      setMonthlySummarySource(globalModels.monthlySummarySource ?? 'weeklies')
      setGenerationLocale(autoLocale)
      setActivePromptLocale(autoLocale)
      setLocalText(
        getSummaryTemplateForEdit(saved.instructionsByLocale ?? {}, autoLocale, 'weekly')
      )
      setLocalSystemPrompt(
        saved.customGenerationSystemPromptByLocale?.[autoLocale]?.trim() ||
          getDefaultCustomGenerationSystemPrompt(autoLocale)
      )
      if (saved.promptLocale !== autoLocale) {
        await services.settingsManager.set('summary_config', {
          ...saved,
          promptLocale: autoLocale
        })
      }

      try {
        const list = await listAssistantsForUi(
          services.assistantManager,
          services.attachmentManager,
          services.fileSystem
        )
        setAssistants(
          list.map((a) => ({
            id: String(a.id),
            name: a.name || String(a.id),
            avatarPath: a.avatarPath,
            displayAvatarUri: a.displayAvatarUri
          }))
        )
      } catch {
        setAssistants([])
      }
    })()
  }, [dbReady, services, i18n.language])

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved = (await services.settingsManager.get<SummaryConfig>('summary_config')) || {}
      const settings = (await services.settingsManager.get<{ language?: string }>('settings')) || {}
      const uiLang = resolveAppUiLanguage(settings.language, i18n.language)
      const autoLocale = resolveSummaryPromptLocale(uiLang)
      setGenerationLocale(autoLocale)
      setActivePromptLocale(autoLocale)
      setLocalText(
        getSummaryTemplateForEdit(
          saved.instructionsByLocale ?? {},
          autoLocale,
          activeTabRef.current
        )
      )
      setLocalSystemPrompt(
        saved.customGenerationSystemPromptByLocale?.[autoLocale]?.trim() ||
          getDefaultCustomGenerationSystemPrompt(autoLocale)
      )
      if (saved.promptLocale !== autoLocale) {
        await services.settingsManager.set('summary_config', {
          ...saved,
          promptLocale: autoLocale
        })
      }
    })()
  }, [dbReady, i18n.language, services])

  const patchLocaleTemplates = useCallback(
    (locale: SummaryPromptLocale, type: SummaryTemplateKey, text: string) => ({
      ...(summaryConfig.instructionsByLocale || {}),
      [locale]: {
        ...(summaryConfig.instructionsByLocale?.[locale] || {}),
        [type]: text
      }
    }),
    [summaryConfig.instructionsByLocale]
  )

  const patchSystemPrompt = useCallback(
    (locale: SummaryPromptLocale, text: string) => ({
      ...(summaryConfig.customGenerationSystemPromptByLocale || {}),
      [locale]: text
    }),
    [summaryConfig.customGenerationSystemPromptByLocale]
  )

  const persistConfig = useCallback(
    async (next: SummaryConfig, options?: { replaceLocalTemplates?: boolean }) => {
      if (!services || !dbReady) return
      await services.settingsManager.set('summary_config', next)
      if (options?.replaceLocalTemplates) {
        setSummaryConfig(next)
        persistedTemplatesRef.current = next.instructionsByLocale
        return
      }
      setSummaryConfig((prev) => ({
        ...next,
        // Keep in-memory template drafts until explicit Save / Restore default.
        instructionsByLocale: prev.instructionsByLocale ?? next.instructionsByLocale
      }))
    },
    [dbReady, services]
  )

  const enqueuePersist = (fn: () => Promise<void>) => {
    persistChainRef.current = persistChainRef.current.then(fn).catch((err) => {
      console.warn('[SummarySettingsSection] failed to persist', err)
    })
  }

  const persistMonthlySource = async (source: 'weeklies' | 'diaries') => {
    if (!services || !dbReady) return
    const globalModels =
      (await services.settingsManager.get<Record<string, unknown>>('global_models')) || {}
    await services.settingsManager.set('global_models', {
      ...globalModels,
      monthlySummarySource: source
    })
    setMonthlySummarySource(source)
  }

  /** Auto-save everything except generation templates. */
  const persistAutoSettings = (overrides: {
    generationMode?: SummaryGenerationMode
    generationAssistantId?: string
    injectSharedMemory?: boolean
    lookbackMonths?: number
    customGenerationSystemPromptByLocale?: SummaryConfig['customGenerationSystemPromptByLocale']
    monthlySummarySource?: 'weeklies' | 'diaries'
  }) => {
    const nextMode = overrides.generationMode ?? generationMode
    const nextAssistantId =
      overrides.generationAssistantId !== undefined
        ? overrides.generationAssistantId
        : generationAssistantId
    const nextInject = overrides.injectSharedMemory ?? injectSharedMemory
    const nextLookback = overrides.lookbackMonths ?? lookbackMonths
    const nextSystem =
      overrides.customGenerationSystemPromptByLocale ??
      patchSystemPrompt(activePromptLocale, localSystemPromptRef.current)

    // Any auto-save path flushes the current system-prompt draft.
    systemPromptDirtyRef.current = false

    setGenerationMode(nextMode)
    setGenerationAssistantId(nextAssistantId)
    setInjectSharedMemory(nextInject)
    setLookbackMonths(nextLookback)
    if (overrides.monthlySummarySource) setMonthlySummarySource(overrides.monthlySummarySource)

    enqueuePersist(async () => {
      if (!services || !dbReady) return
      if (overrides.monthlySummarySource) {
        await persistMonthlySource(overrides.monthlySummarySource)
      }
      const latest = (await services.settingsManager.get<SummaryConfig>('summary_config')) || {}
      const next: SummaryConfig = {
        ...latest,
        instructionsByLocale: persistedTemplatesRef.current ?? latest.instructionsByLocale,
        promptLocale: generationLocale,
        customGenerationSystemPromptByLocale: nextSystem,
        generationMode: nextMode,
        generationAssistantId: nextAssistantId,
        injectSharedMemoryBeforeGenerate: nextInject,
        sharedMemoryLookbackMonths: nextLookback
      }
      await persistConfig(next)
    })
  }

  const flushSystemPromptNow = useCallback(() => {
    if (!systemPromptDirtyRef.current) return
    const locale = activePromptLocaleRef.current
    const text = localSystemPromptRef.current
    const cfg = summaryConfigRef.current
    const customGenerationSystemPromptByLocale = {
      ...(cfg.customGenerationSystemPromptByLocale || {}),
      [locale]: text
    }
    systemPromptDirtyRef.current = false
    setSummaryConfig((prev) => ({
      ...prev,
      customGenerationSystemPromptByLocale
    }))
    enqueuePersist(async () => {
      if (!services || !dbReady) return
      const latest = (await services.settingsManager.get<SummaryConfig>('summary_config')) || {}
      const next: SummaryConfig = {
        ...latest,
        instructionsByLocale: persistedTemplatesRef.current ?? latest.instructionsByLocale,
        promptLocale: generationLocaleRef.current,
        customGenerationSystemPromptByLocale: {
          ...(latest.customGenerationSystemPromptByLocale || {}),
          [locale]: text
        },
        generationMode: generationModeRef.current,
        generationAssistantId: generationAssistantIdRef.current,
        injectSharedMemoryBeforeGenerate: injectSharedMemoryRef.current,
        sharedMemoryLookbackMonths: lookbackMonthsRef.current
      }
      await persistConfig(next)
    })
  }, [dbReady, persistConfig, services])

  useEffect(() => {
    if (!systemPromptDirtyRef.current) return
    const timer = setTimeout(() => {
      flushSystemPromptNow()
    }, 400)
    return () => clearTimeout(timer)
  }, [localSystemPrompt, flushSystemPromptNow])

  // Leave page / unmount: blur often doesn't fire on native navigation.
  useEffect(() => {
    return () => {
      if (!systemPromptDirtyRef.current) return
      const locale = activePromptLocaleRef.current
      const text = localSystemPromptRef.current
      systemPromptDirtyRef.current = false
      const servicesNow = servicesRef.current
      const dbReadyNow = dbReadyRef.current
      if (!servicesNow || !dbReadyNow) return
      void (async () => {
        const latest =
          (await servicesNow.settingsManager.get<SummaryConfig>('summary_config')) || {}
        await servicesNow.settingsManager.set('summary_config', {
          ...latest,
          instructionsByLocale: persistedTemplatesRef.current ?? latest.instructionsByLocale,
          promptLocale: generationLocaleRef.current,
          customGenerationSystemPromptByLocale: {
            ...(latest.customGenerationSystemPromptByLocale || {}),
            [locale]: text
          },
          generationMode: generationModeRef.current,
          generationAssistantId: generationAssistantIdRef.current,
          injectSharedMemoryBeforeGenerate: injectSharedMemoryRef.current,
          sharedMemoryLookbackMonths: lookbackMonthsRef.current
        })
      })()
    }
  }, [])

  const handleTabChange = (tab: SummaryTemplateKey) => {
    const merged = {
      ...summaryConfig,
      instructionsByLocale: patchLocaleTemplates(activePromptLocale, activeTab, localText)
    }
    setSummaryConfig(merged)
    setActiveTab(tab)
    setLocalText(
      getSummaryTemplateForEdit(merged.instructionsByLocale ?? {}, activePromptLocale, tab)
    )
  }

  const handlePromptLocaleChange = (locale: SummaryPromptLocale) => {
    const customGenerationSystemPromptByLocale = patchSystemPrompt(
      activePromptLocale,
      localSystemPromptRef.current
    )
    const merged = {
      ...summaryConfig,
      instructionsByLocale: patchLocaleTemplates(activePromptLocale, activeTab, localText),
      customGenerationSystemPromptByLocale
    }
    setSummaryConfig(merged)
    setActivePromptLocale(locale)
    setLocalText(getSummaryTemplateForEdit(merged.instructionsByLocale, locale, activeTab))
    systemPromptDirtyRef.current = false
    setLocalSystemPrompt(
      customGenerationSystemPromptByLocale[locale]?.trim() ||
        getDefaultCustomGenerationSystemPrompt(locale)
    )
    persistAutoSettings({ customGenerationSystemPromptByLocale })
  }

  const handleSave = async () => {
    if (generationMode === 'assistant' && !generationAssistantId) {
      toast.showError(t('settings.summary_generation_assistant_required'))
      return
    }
    const settings = (await services?.settingsManager.get<{ language?: string }>('settings')) || {}
    const uiLang = resolveAppUiLanguage(settings.language, i18n.language)
    const autoLocale = resolveSummaryPromptLocale(uiLang)
    const instructionsByLocale = patchLocaleTemplates(activePromptLocale, activeTab, localText)
    const next: SummaryConfig = {
      ...summaryConfig,
      instructionsByLocale,
      promptLocale: autoLocale,
      customGenerationSystemPromptByLocale: patchSystemPrompt(
        activePromptLocale,
        localSystemPrompt
      ),
      generationMode,
      generationAssistantId,
      injectSharedMemoryBeforeGenerate: injectSharedMemory,
      sharedMemoryLookbackMonths: lookbackMonths
    }
    await persistConfig(next, { replaceLocalTemplates: true })
    setGenerationLocale(autoLocale)
    toast.showSuccess(t('settings.saved'))
  }

  const handleReset = async () => {
    const defaultText = getDefaultSummaryTemplate(activeTab, activePromptLocale)
    setLocalText(defaultText)
    const instructionsByLocale = patchLocaleTemplates(activePromptLocale, activeTab, defaultText)
    const next: SummaryConfig = {
      ...summaryConfig,
      instructionsByLocale,
      generationMode,
      generationAssistantId,
      injectSharedMemoryBeforeGenerate: injectSharedMemory,
      sharedMemoryLookbackMonths: lookbackMonths,
      customGenerationSystemPromptByLocale: patchSystemPrompt(activePromptLocale, localSystemPrompt)
    }
    await persistConfig(next, { replaceLocalTemplates: true })
    toast.showSuccess(t('summary.reset_template_success'))
  }

  const tabs = useMemo(
    () =>
      TEMPLATE_KEYS.map((id) => ({
        id,
        icon: TAB_META[id].icon,
        label: t(TAB_META[id].labelKey)
      })),
    [t]
  )

  const generationLabel =
    SUMMARY_PROMPT_LOCALE_OPTIONS.find((l) => l.id === generationLocale)?.fallback ??
    generationLocale

  const langBar = (
    <View style={styles.langBar}>
      {SUMMARY_PROMPT_LOCALE_OPTIONS.map((lang) => (
        <TouchableOpacity
          key={lang.id}
          style={[
            styles.langChip,
            {
              borderColor: activePromptLocale === lang.id ? colors.primary : colors.borderMuted,
              backgroundColor: activePromptLocale === lang.id ? colors.primary : 'transparent'
            },
            generationLocale === lang.id && styles.langChipGeneration
          ]}
          onPress={() => handlePromptLocaleChange(lang.id)}
        >
          <Text
            style={{
              color: activePromptLocale === lang.id ? colors.textOnPrimary : colors.textSecondary,
              fontSize: 13,
              fontWeight: activePromptLocale === lang.id ? '600' : '400'
            }}
          >
            {t(lang.labelKey, lang.fallback)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.summary_generation_mode_title')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.summary_generation_mode_desc')}
        </Text>
        <View style={[styles.sourceGroup, { backgroundColor: colors.bgApp }]}>
          {(['prompt', 'assistant'] as const).map((mode) => {
            const active = generationMode === mode
            const labelKey =
              mode === 'prompt'
                ? 'settings.summary_generation_mode_prompt'
                : 'settings.summary_generation_mode_assistant'
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.sourceBtn, active && { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (mode === 'assistant') {
                    if (assistants.length === 0) {
                      toast.showError(t('settings.summary_generation_assistant_required'))
                      return
                    }
                    const nextId =
                      generationAssistantId &&
                      assistants.some((a) => a.id === generationAssistantId)
                        ? generationAssistantId
                        : assistants[0]!.id
                    persistAutoSettings({
                      generationMode: 'assistant',
                      generationAssistantId: nextId
                    })
                    return
                  }
                  persistAutoSettings({ generationMode: 'prompt' })
                }}
              >
                <Text
                  style={{
                    color: active ? colors.textOnPrimary : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: active ? '600' : '400',
                    textAlign: 'center'
                  }}
                >
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {generationMode === 'prompt' && (
          <View style={styles.systemPromptBlock}>
            <Text style={[styles.subsectionTitle, { color: colors.textPrimary }]}>
              {t('settings.summary_custom_system_prompt_title')}
            </Text>
            <Text style={[styles.desc, { color: colors.textSecondary }]}>
              {t('settings.summary_custom_system_prompt_desc')}
            </Text>
            {langBar}
            <Input
              value={localSystemPrompt}
              onChangeText={(text) => {
                systemPromptDirtyRef.current = true
                setLocalSystemPrompt(text)
              }}
              onBlur={() => flushSystemPromptNow()}
              multiline
              textarea
              numberOfLines={8}
              placeholder={t('settings.summary_custom_system_prompt_hint')}
              style={{ minHeight: 140, lineHeight: 20 }}
              containerStyle={{ marginBottom: 8 }}
            />
            <TouchableOpacity
              style={[styles.btn, { borderColor: colors.borderSubtle, marginBottom: 4 }]}
              onPress={() => {
                const defaultText = getDefaultCustomGenerationSystemPrompt(activePromptLocale)
                systemPromptDirtyRef.current = false
                setLocalSystemPrompt(defaultText)
                persistAutoSettings({
                  customGenerationSystemPromptByLocale: patchSystemPrompt(
                    activePromptLocale,
                    defaultText
                  )
                })
                toast.showSuccess(t('summary.reset_template_success'))
              }}
            >
              <Text style={{ color: colors.textSecondary }}>{t('settings.restore_default')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {generationMode === 'assistant' && (
          <View style={styles.assistantBlock}>
            <Text style={[styles.subsectionTitle, { color: colors.textPrimary }]}>
              {t('settings.summary_generation_assistant_label')}
            </Text>
            <TouchableOpacity
              style={[styles.partnerCard, { borderColor: colors.borderMuted }]}
              onPress={() => setPartnerPickerOpen(true)}
            >
              {selectedPartner?.displayAvatarUri ? (
                <Image
                  source={{ uri: selectedPartner.displayAvatarUri }}
                  style={styles.partnerAvatarImage}
                />
              ) : (
                <View style={[styles.partnerAvatar, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
                    {(selectedPartner?.name || '?').slice(0, 1)}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.partnerName, { color: colors.textPrimary }]}>
                  {selectedPartner?.name || t('settings.summary_generation_assistant_placeholder')}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                  {t('settings.summary_generation_partner_change')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.injectRow}>
          <View style={styles.injectText}>
            <Text style={[styles.subsectionTitle, { color: colors.textPrimary, marginBottom: 4 }]}>
              {t('settings.summary_inject_shared_memory')}
            </Text>
            <Text style={[styles.desc, { color: colors.textSecondary, marginBottom: 0 }]}>
              {t('settings.summary_inject_shared_memory_desc')}
            </Text>
          </View>
          <Switch
            value={injectSharedMemory}
            onValueChange={(v) => persistAutoSettings({ injectSharedMemory: v })}
          />
        </View>

        {injectSharedMemory && (
          <View style={styles.lookbackBlock}>
            <View style={styles.lookbackLabelRow}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginBottom: 0 }]}>
                {t('settings.summary_inject_lookback_label')}
              </Text>
              <Input
                value={String(lookbackMonths)}
                onChangeText={(text) => {
                  const n = Number(text.replace(/[^\d]/g, ''))
                  if (!Number.isFinite(n)) return
                  setLookbackMonths(clampSharedMemoryLookbackMonths(n || 1))
                }}
                onBlur={() =>
                  persistAutoSettings({
                    lookbackMonths: clampSharedMemoryLookbackMonths(lookbackMonthsRef.current)
                  })
                }
                keyboardType="number-pad"
                style={{ textAlign: 'center' }}
                containerStyle={{ marginBottom: 0, width: 72 }}
              />
            </View>
            <NativeSlider
              minValue={SHARED_MEMORY_LOOKBACK_MIN}
              maxValue={Math.max(SHARED_MEMORY_LOOKBACK_SLIDER_BASE, lookbackMonths)}
              step={1}
              value={lookbackMonths}
              onChange={(v) => setLookbackMonths(clampSharedMemoryLookbackMonths(v))}
              onChangeEnd={(v) =>
                persistAutoSettings({
                  lookbackMonths: clampSharedMemoryLookbackMonths(v)
                })
              }
            />
          </View>
        )}
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.summary_data_sources_title')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.summary_data_sources_desc')}
        </Text>
        <Text style={[styles.dataSourceLine, { color: colors.textSecondary }]}>
          {t('settings.summary_data_source_weekly')}
        </Text>
        <Text style={[styles.dataSourceLine, { color: colors.textSecondary }]}>
          {t('settings.summary_data_source_monthly')}
        </Text>
        <Text style={[styles.dataSourceLine, { color: colors.textSecondary }]}>
          {t('settings.summary_data_source_quarterly')}
        </Text>
        <Text style={[styles.dataSourceLine, { color: colors.textSecondary }]}>
          {t('settings.summary_data_source_yearly')}
        </Text>

        <Text style={[styles.cardTitle, { color: colors.textPrimary, marginTop: 12 }]}>
          {t('settings.monthly_summary_data_source')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.monthly_summary_data_source_desc')}
        </Text>
        <View style={[styles.sourceGroup, { backgroundColor: colors.bgApp }]}>
          {(['weeklies', 'diaries'] as const).map((source) => {
            const active = monthlySummarySource === source
            const labelKey =
              source === 'weeklies' ? 'settings.read_only_weeklies' : 'settings.read_all_diaries'
            return (
              <TouchableOpacity
                key={source}
                style={[styles.sourceBtn, active && { backgroundColor: colors.primary }]}
                onPress={() => persistAutoSettings({ monthlySummarySource: source })}
              >
                <Text
                  style={{
                    color: active ? colors.textOnPrimary : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: active ? '600' : '400',
                    textAlign: 'center'
                  }}
                >
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.summary_generation_templates_title')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.summary_generation_templates_desc')}
        </Text>

        <Text style={[styles.localeHint, { color: colors.textSecondary }]}>
          {t('settings.summary_prompt_locale_hint')}:{' '}
          <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{generationLabel}</Text>
        </Text>

        {langBar}

        <View style={[styles.tabBar, { backgroundColor: colors.bgApp }]}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, active && { backgroundColor: colors.primary }]}
                onPress={() => handleTabChange(tab.id)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text
                  style={{
                    color: active ? colors.textOnPrimary : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: active ? '600' : '400'
                  }}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Input
          value={localText}
          onChangeText={setLocalText}
          multiline
          textarea
          numberOfLines={14}
          placeholder={t('settings.summary_ai_prompt_hint')}
          style={{ minHeight: 220, lineHeight: 20 }}
          containerStyle={{ marginBottom: 16 }}
        />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, { borderColor: colors.borderSubtle }]}
            onPress={() => void handleReset()}
          >
            <Text style={{ color: colors.textSecondary }}>{t('settings.restore_default')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={() => void handleSave()}
          >
            <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
              {t('common.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </SettingsGroupCard>

      <Modal
        visible={partnerPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPartnerPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPartnerPickerOpen(false)}
        >
          <View
            style={[styles.modalSheet, { backgroundColor: colors.bgSurface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t('settings.summary_generation_assistant_placeholder')}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {assistants.map((a) => {
                const active = a.id === generationAssistantId
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      styles.partnerPickerItem,
                      active && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => {
                      persistAutoSettings({
                        generationMode: 'assistant',
                        generationAssistantId: a.id
                      })
                      setPartnerPickerOpen(false)
                    }}
                  >
                    {a.displayAvatarUri ? (
                      <Image
                        source={{ uri: a.displayAvatarUri }}
                        style={styles.partnerAvatarImageSmall}
                      />
                    ) : (
                      <View
                        style={[
                          styles.partnerAvatarSmall,
                          {
                            backgroundColor: active
                              ? 'rgba(255,255,255,0.25)'
                              : colors.primary + '22'
                          }
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? colors.textOnPrimary : colors.primary,
                            fontWeight: '600',
                            fontSize: 13
                          }}
                        >
                          {a.name.slice(0, 1)}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{
                        color: active ? colors.textOnPrimary : colors.textPrimary,
                        fontWeight: active ? '600' : '400',
                        fontSize: 14,
                        flex: 1
                      }}
                    >
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8, lineHeight: 22 },
  subsectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, lineHeight: 20 },
  sourceGroup: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 8,
    marginBottom: 4
  },
  sourceBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  desc: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, lineHeight: 20 },
  systemPromptBlock: { marginTop: 14 },
  assistantBlock: { marginTop: 14 },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1
  },
  partnerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  partnerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18
  },
  partnerAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  partnerAvatarImageSmall: {
    width: 28,
    height: 28,
    borderRadius: 14
  },
  partnerName: { fontWeight: '600', fontSize: 14, lineHeight: 20 },
  injectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 18
  },
  injectText: { flex: 1 },
  lookbackBlock: { marginTop: 14, gap: 10 },
  lookbackLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  dataSourceLine: { fontSize: 13, lineHeight: 20, marginBottom: 4 },
  localeHint: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  langBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  langChipGeneration: {
    borderStyle: 'dashed'
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
    borderRadius: 8,
    marginBottom: 12
  },
  tabBtn: {
    flex: 1,
    minWidth: '22%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 6
  },
  tabIcon: { fontSize: 16 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  saveBtn: { borderWidth: 0 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24
  },
  modalSheet: {
    borderRadius: 14,
    padding: 16,
    maxHeight: '70%'
  },
  partnerPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4
  }
})
