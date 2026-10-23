import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS,
  getDefaultCustomGenerationSystemPrompt,
  getSummaryTemplateForEdit,
  SHARED_MEMORY_LOOKBACK_MIN,
  SHARED_MEMORY_LOOKBACK_SLIDER_BASE,
  SUMMARY_PROMPT_LOCALE_OPTIONS,
  type SharedMemoryCopyPreview,
  type SummaryPromptLocale,
  type SummaryTemplateKey
} from '@baishou/shared'
import type { SummaryInstructionsConfig, SummarySettingsViewProps } from './summary-settings.types'

export function useSummarySettingsView({
  config,
  assistants = [],
  onChange,
  onResetTemplate
}: SummarySettingsViewProps) {
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
          const api = (
            window as Window & {
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
            }
          ).api
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
    ): typeof draftTemplates => ({
      ...draftTemplates,
      [locale]: {
        ...draftTemplates[locale],
        [type]: text
      }
    }),
    [draftTemplates]
  )

  const patchSystemPrompt = useCallback(
    (locale: SummaryPromptLocale, text: string) => ({
      ...config.customGenerationSystemPromptByLocale,
      [locale]: text
    }),
    [config.customGenerationSystemPromptByLocale]
  )

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

  return {
    t,
    toast,
    config,
    assistants,
    activeTab,
    activePromptLocale,
    localText,
    setLocalText,
    localSystemPrompt,
    setLocalSystemPrompt,
    systemPromptDirtyRef,
    partnerPickerOpen,
    setPartnerPickerOpen,
    lookbackDraft,
    lookbackDraggingRef,
    selectedPartner,
    injectEnabled,
    injectPreview,
    injectPreviewLoading,
    emitSettings,
    handleTabChange,
    handlePromptLocaleChange,
    handleSave,
    handleReset,
    handleResetSystemPrompt,
    previewLookback,
    commitLookback,
    tabs,
    activeLocaleLabel,
    sliderMax,
    sliderPct
  }
}

export type SummarySettingsViewModel = ReturnType<typeof useSummarySettingsView>
