import type {
  SummaryGenerationMode,
  SummaryPromptLocale,
  SummaryTemplateKey,
  SummaryTemplatesMap
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
