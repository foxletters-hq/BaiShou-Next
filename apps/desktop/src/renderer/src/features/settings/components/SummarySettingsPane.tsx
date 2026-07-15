import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SummarySettingsView } from '@baishou/ui'
import { useSettingsStore } from '@baishou/store'
import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS,
  getDefaultSummaryTemplate,
  normalizeSummaryInstructionsByLocale,
  normalizeSummaryGenerationMode,
  resolveSummaryPromptLocale,
  type SummaryPromptLocale,
  type SummaryTemplateKey
} from '@baishou/shared'

interface SummarySettingsPaneProps {
  settings: any
}

export const SummarySettingsPane: React.FC<SummarySettingsPaneProps> = ({ settings }) => {
  const { i18n } = useTranslation()
  const [assistants, setAssistants] = useState<
    Array<{ id: string; name: string; avatarPath?: string }>
  >([])
  const persistChainRef = useRef(Promise.resolve())

  useEffect(() => {
    void (async () => {
      try {
        const data = await window.electron.ipcRenderer.invoke('agent:get-assistants')
        const list = Array.isArray(data) ? data : []
        setAssistants(
          list.map((a: { id: string; name?: string; avatarPath?: string }) => ({
            id: String(a.id),
            name: a.name || String(a.id),
            avatarPath: a.avatarPath
          }))
        )
      } catch {
        setAssistants([])
      }
    })()
  }, [])

  const uiLocale = settings.locale === 'system' ? i18n.language : settings.locale

  const combinedConfig = useMemo(() => {
    if (settings.isLoading || !settings.summaryConfig || !settings.globalModels) {
      return null
    }

    const summaryConfig = settings.summaryConfig
    const instructionsByLocale = normalizeSummaryInstructionsByLocale(summaryConfig)
    const promptLocale = resolveSummaryPromptLocale(uiLocale)

    return {
      monthlySummarySource: settings.globalModels.monthlySummarySource || 'weeklies',
      promptLocale,
      instructionsByLocale,
      customGenerationSystemPromptByLocale:
        summaryConfig.customGenerationSystemPromptByLocale || {},
      generationMode: normalizeSummaryGenerationMode(summaryConfig.generationMode),
      generationAssistantId: summaryConfig.generationAssistantId,
      injectSharedMemoryBeforeGenerate: !!summaryConfig.injectSharedMemoryBeforeGenerate,
      sharedMemoryLookbackMonths: clampSharedMemoryLookbackMonths(
        summaryConfig.sharedMemoryLookbackMonths ?? DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS
      )
    }
  }, [settings.isLoading, settings.summaryConfig, settings.globalModels, uiLocale])

  if (!combinedConfig) return <div />

  return (
    <div className="settings-pane settings-pane-full">
      <SummarySettingsView
        config={combinedConfig}
        assistants={assistants}
        onChange={(newConfig, options) => {
          const includeTemplates = options?.includeTemplates === true
          const promptLocale = resolveSummaryPromptLocale(uiLocale)
          persistChainRef.current = persistChainRef.current
            .then(async () => {
              const store = useSettingsStore.getState()
              const globalModels = store.globalModels
              if (
                globalModels &&
                globalModels.monthlySummarySource !== newConfig.monthlySummarySource
              ) {
                await store.setGlobalModels({
                  ...globalModels,
                  monthlySummarySource: newConfig.monthlySummarySource
                })
              }
              const latest = useSettingsStore.getState().summaryConfig || {}
              await store.setSummaryConfig({
                ...latest,
                promptLocale,
                ...(includeTemplates
                  ? {
                      instructionsByLocale: newConfig.instructionsByLocale,
                      instructions: newConfig.instructionsByLocale.zh
                    }
                  : {}),
                customGenerationSystemPromptByLocale:
                  newConfig.customGenerationSystemPromptByLocale,
                generationMode: newConfig.generationMode,
                generationAssistantId: newConfig.generationAssistantId,
                injectSharedMemoryBeforeGenerate: newConfig.injectSharedMemoryBeforeGenerate,
                sharedMemoryLookbackMonths: newConfig.sharedMemoryLookbackMonths
              })
            })
            .catch((err) => {
              console.warn('[SummarySettingsPane] failed to persist summary settings', err)
            })
        }}
        onResetTemplate={(type: SummaryTemplateKey, locale: SummaryPromptLocale) =>
          getDefaultSummaryTemplate(type, locale)
        }
      />
    </div>
  )
}
