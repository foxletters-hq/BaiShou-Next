import type { SummaryConfig, SummaryPromptLocale, SummaryTemplateKey } from '@baishou/shared'

export const SUMMARY_TEMPLATE_KEYS: SummaryTemplateKey[] = [
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
]

export const SUMMARY_TAB_META: Record<SummaryTemplateKey, { icon: string; labelKey: string }> = {
  weekly: { icon: '🌱', labelKey: 'summary.tab_weekly' },
  monthly: { icon: '☘️', labelKey: 'summary.tab_monthly' },
  quarterly: { icon: '🪴', labelKey: 'summary.tab_quarterly' },
  yearly: { icon: '🌳', labelKey: 'summary.tab_yearly' }
}

export function patchSummaryLocaleTemplates(
  current: SummaryConfig['instructionsByLocale'],
  locale: SummaryPromptLocale,
  type: SummaryTemplateKey,
  text: string
): NonNullable<SummaryConfig['instructionsByLocale']> {
  return {
    ...(current || {}),
    [locale]: {
      ...(current?.[locale] || {}),
      [type]: text
    }
  }
}

export function patchSummarySystemPrompt(
  current: SummaryConfig['customGenerationSystemPromptByLocale'],
  locale: SummaryPromptLocale,
  text: string
): NonNullable<SummaryConfig['customGenerationSystemPromptByLocale']> {
  return {
    ...(current || {}),
    [locale]: text
  }
}
