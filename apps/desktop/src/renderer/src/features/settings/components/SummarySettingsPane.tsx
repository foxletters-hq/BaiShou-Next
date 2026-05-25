import React from 'react'
import { SummarySettingsView } from '@baishou/ui'
import { DEFAULT_SUMMARY_TEMPLATES } from '@baishou/shared'

interface SummarySettingsPaneProps {
  settings: any
}

export const SummarySettingsPane: React.FC<SummarySettingsPaneProps> = ({ settings }) => {
  // If settings are not loaded yet, wait.
  if (settings.isLoading || !settings.summaryConfig || !settings.globalModels) return <div />

  const currentInstructions = settings.summaryConfig.instructions || {}

  const combinedConfig = {
    monthlySummarySource: settings.globalModels.monthlySummarySource || 'weeklies',
    templates: {
      weekly: currentInstructions.weekly || DEFAULT_SUMMARY_TEMPLATES.weekly,
      monthly: currentInstructions.monthly || DEFAULT_SUMMARY_TEMPLATES.monthly,
      quarterly: currentInstructions.quarterly || DEFAULT_SUMMARY_TEMPLATES.quarterly,
      yearly: currentInstructions.yearly || DEFAULT_SUMMARY_TEMPLATES.yearly
    }
  }

  return (
    <div className="settings-pane settings-pane-full">
      <SummarySettingsView
        config={combinedConfig}
        onChange={(newConfig) => {
          settings.setGlobalModels({
            ...settings.globalModels,
            monthlySummarySource: newConfig.monthlySummarySource
          })
          settings.setSummaryConfig({
            ...settings.summaryConfig,
            instructions: newConfig.templates
          })
        }}
        onResetTemplate={(type) => {
          return DEFAULT_SUMMARY_TEMPLATES[type] || ''
        }}
      />
    </div>
  )
}
