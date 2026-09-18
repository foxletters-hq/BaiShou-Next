import React from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import stack from '../shared/SettingsStack.module.css'
import { useSummarySettingsView } from './useSummarySettingsView'
import { SummaryGenerationSection } from './SummaryGenerationSection'
import { SummaryInjectSection } from './SummaryInjectSection'
import { SummaryTemplateSection } from './SummaryTemplateSection'
import type { SummarySettingsViewProps } from './summary-settings.types'

export type {
  SummaryInstructionsConfig,
  SummarySettingsAssistantOption,
  SummarySettingsChangeOptions,
  SummarySettingsViewProps
} from './summary-settings.types'

export const SummarySettingsView: React.FC<SummarySettingsViewProps> = (props) => {
  const { t } = useTranslation()
  const vm = useSummarySettingsView(props)

  return (
    <SettingsPageChrome title={t('settings.summary_settings_title', '回忆生成设置')}>
      <div className={stack.stack}>
        <SummaryGenerationSection vm={vm} />
        <SummaryInjectSection vm={vm} />
        <SummaryTemplateSection vm={vm} />
      </div>
    </SettingsPageChrome>
  )
}
