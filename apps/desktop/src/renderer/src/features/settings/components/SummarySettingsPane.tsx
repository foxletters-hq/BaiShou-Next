import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SummarySettingsView } from '@baishou/ui'
import {
  getDefaultSummaryTemplate,
  normalizeSummaryInstructionsByLocale,
  resolveSummaryPromptLocale,
  type SummaryPromptLocale,
  type SummaryTemplateKey
} from '@baishou/shared'

interface SummarySettingsPaneProps {
  settings: any
}

export const SummarySettingsPane: React.FC<SummarySettingsPaneProps> = ({ settings }) => {
  const { i18n } = useTranslation()

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
      instructionsByLocale
    }
  }, [settings.isLoading, settings.summaryConfig, settings.globalModels, uiLocale])

  if (!combinedConfig) return <div />

  return (
    <div className="settings-pane settings-pane-full">
      <SummarySettingsView
        config={combinedConfig}
        onChange={(newConfig) => {
          settings.setGlobalModels({
            ...settings.globalModels,
            monthlySummarySource: newConfig.monthlySummarySource
          })
          const promptLocale = resolveSummaryPromptLocale(uiLocale)
          settings.setSummaryConfig({
            ...settings.summaryConfig,
            promptLocale,
            instructionsByLocale: newConfig.instructionsByLocale,
            instructions: newConfig.instructionsByLocale.zh
          })
        }}
        onResetTemplate={(type: SummaryTemplateKey, locale: SummaryPromptLocale) =>
          getDefaultSummaryTemplate(type, locale)
        }
      />
    </div>
  )
}
