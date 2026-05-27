import { DEFAULT_SUMMARY_TEMPLATES as SUMMARY_TEMPLATES_ZH } from '../summary-templates'
import { SUMMARY_TEMPLATES_EN } from './summary-templates.en'
import { SUMMARY_TEMPLATES_JA } from './summary-templates.ja'
import { SUMMARY_TEMPLATES_ZH_TW } from './summary-templates.zh-TW'
import type { SummaryPromptLocale, SummaryTemplatesMap } from '../../types/summary-prompt.types'

export const DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE: Record<
  SummaryPromptLocale,
  Required<SummaryTemplatesMap>
> = {
  zh: SUMMARY_TEMPLATES_ZH as Required<SummaryTemplatesMap>,
  en: SUMMARY_TEMPLATES_EN as Required<SummaryTemplatesMap>,
  ja: SUMMARY_TEMPLATES_JA as Required<SummaryTemplatesMap>,
  'zh-TW': SUMMARY_TEMPLATES_ZH_TW as Required<SummaryTemplatesMap>
}
