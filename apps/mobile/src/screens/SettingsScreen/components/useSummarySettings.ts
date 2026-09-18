import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS,
  getDefaultCustomGenerationSystemPrompt,
  getDefaultSummaryTemplate,
  getSummaryTemplateForEdit,
  normalizeSummaryGenerationMode,
  resolveSummaryPromptLocale,
  type SummaryConfig,
  type SummaryGenerationMode,
  type SummaryPromptLocale,
  type SummaryTemplateKey
} from '@baishou/shared'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { resolveAppUiLanguage } from '../../../lib/device-locale'
import { listAssistantsForUi } from '../../../lib/mobile-assistant.util'
import {
  patchSummaryLocaleTemplates,
  patchSummarySystemPrompt,
  SUMMARY_TAB_META,
  SUMMARY_TEMPLATE_KEYS
} from './summary-settings.util'

export function useSummarySettings() {
  const { t, i18n } = useTranslation()
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
      patchSummarySystemPrompt(
        summaryConfig.customGenerationSystemPromptByLocale,
        activePromptLocale,
        localSystemPromptRef.current
      )

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
      instructionsByLocale: patchSummaryLocaleTemplates(
        summaryConfig.instructionsByLocale,
        activePromptLocale,
        activeTab,
        localText
      )
    }
    setSummaryConfig(merged)
    setActiveTab(tab)
    setLocalText(
      getSummaryTemplateForEdit(merged.instructionsByLocale ?? {}, activePromptLocale, tab)
    )
  }

  const handlePromptLocaleChange = (locale: SummaryPromptLocale) => {
    const customGenerationSystemPromptByLocale = patchSummarySystemPrompt(
      summaryConfig.customGenerationSystemPromptByLocale,
      activePromptLocale,
      localSystemPromptRef.current
    )
    const merged = {
      ...summaryConfig,
      instructionsByLocale: patchSummaryLocaleTemplates(
        summaryConfig.instructionsByLocale,
        activePromptLocale,
        activeTab,
        localText
      ),
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
    const instructionsByLocale = patchSummaryLocaleTemplates(
      summaryConfig.instructionsByLocale,
      activePromptLocale,
      activeTab,
      localText
    )
    const next: SummaryConfig = {
      ...summaryConfig,
      instructionsByLocale,
      promptLocale: autoLocale,
      customGenerationSystemPromptByLocale: patchSummarySystemPrompt(
        summaryConfig.customGenerationSystemPromptByLocale,
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
    const instructionsByLocale = patchSummaryLocaleTemplates(
      summaryConfig.instructionsByLocale,
      activePromptLocale,
      activeTab,
      defaultText
    )
    const next: SummaryConfig = {
      ...summaryConfig,
      instructionsByLocale,
      generationMode,
      generationAssistantId,
      injectSharedMemoryBeforeGenerate: injectSharedMemory,
      sharedMemoryLookbackMonths: lookbackMonths,
      customGenerationSystemPromptByLocale: patchSummarySystemPrompt(
        summaryConfig.customGenerationSystemPromptByLocale,
        activePromptLocale,
        localSystemPrompt
      )
    }
    await persistConfig(next, { replaceLocalTemplates: true })
    toast.showSuccess(t('summary.reset_template_success'))
  }

  const tabs = useMemo(
    () =>
      SUMMARY_TEMPLATE_KEYS.map((id) => ({
        id,
        icon: SUMMARY_TAB_META[id].icon,
        label: t(SUMMARY_TAB_META[id].labelKey)
      })),
    [t]
  )

  const markSystemPromptDirty = (text: string) => {
    systemPromptDirtyRef.current = true
    setLocalSystemPrompt(text)
  }

  const restoreSystemPromptDefault = () => {
    const defaultText = getDefaultCustomGenerationSystemPrompt(activePromptLocale)
    systemPromptDirtyRef.current = false
    setLocalSystemPrompt(defaultText)
    persistAutoSettings({
      customGenerationSystemPromptByLocale: patchSummarySystemPrompt(
        summaryConfig.customGenerationSystemPromptByLocale,
        activePromptLocale,
        defaultText
      )
    })
    toast.showSuccess(t('summary.reset_template_success'))
  }

  return {
    activeTab,
    activePromptLocale,
    localText,
    setLocalText,
    localSystemPrompt,
    generationLocale,
    monthlySummarySource,
    generationMode,
    generationAssistantId,
    injectSharedMemory,
    lookbackMonths,
    setLookbackMonths,
    lookbackMonthsRef,
    assistants,
    partnerPickerOpen,
    setPartnerPickerOpen,
    selectedPartner,
    tabs,
    persistAutoSettings,
    flushSystemPromptNow,
    handleTabChange,
    handlePromptLocaleChange,
    handleSave,
    handleReset,
    markSystemPromptDirty,
    restoreSystemPromptDefault
  }
}
