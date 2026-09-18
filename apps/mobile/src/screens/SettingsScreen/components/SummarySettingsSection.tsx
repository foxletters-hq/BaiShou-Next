import React from 'react'
import { ScrollView } from 'react-native'
import { SummaryGenerationCard } from './SummaryGenerationCard'
import { SummaryTemplateCard } from './SummaryTemplateCard'
import { useSummarySettings } from './useSummarySettings'

export const SummarySettingsSection: React.FC = () => {
  const summary = useSummarySettings()

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <SummaryGenerationCard
        generationMode={summary.generationMode}
        generationAssistantId={summary.generationAssistantId}
        selectedPartner={summary.selectedPartner}
        assistants={summary.assistants}
        partnerPickerOpen={summary.partnerPickerOpen}
        setPartnerPickerOpen={summary.setPartnerPickerOpen}
        injectSharedMemory={summary.injectSharedMemory}
        lookbackMonths={summary.lookbackMonths}
        lookbackMonthsRef={summary.lookbackMonthsRef}
        setLookbackMonths={summary.setLookbackMonths}
        localSystemPrompt={summary.localSystemPrompt}
        activePromptLocale={summary.activePromptLocale}
        generationLocale={summary.generationLocale}
        persistAutoSettings={summary.persistAutoSettings}
        onPromptLocaleChange={summary.handlePromptLocaleChange}
        onSystemPromptChange={summary.markSystemPromptDirty}
        onSystemPromptBlur={summary.flushSystemPromptNow}
        onRestoreSystemPrompt={summary.restoreSystemPromptDefault}
      />
      <SummaryTemplateCard
        monthlySummarySource={summary.monthlySummarySource}
        persistAutoSettings={summary.persistAutoSettings}
        generationLocale={summary.generationLocale}
        activePromptLocale={summary.activePromptLocale}
        onPromptLocaleChange={summary.handlePromptLocaleChange}
        tabs={summary.tabs}
        activeTab={summary.activeTab}
        onTabChange={summary.handleTabChange}
        localText={summary.localText}
        onLocalText={summary.setLocalText}
        onReset={summary.handleReset}
        onSave={summary.handleSave}
      />
    </ScrollView>
  )
}
