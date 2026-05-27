export type SummaryPromptLocale = 'zh' | 'en' | 'ja' | 'zh-TW'

export type SummaryTemplateKey = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface SummaryTemplatesMap {
  weekly?: string
  monthly?: string
  quarterly?: string
  yearly?: string
}

export const SUMMARY_PROMPT_LOCALES: SummaryPromptLocale[] = ['zh', 'zh-TW', 'en', 'ja']
