import { DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE } from '../constants/summary-templates/index'
import type { SummaryConfig } from '../types/settings.types'
import type {
  SummaryPromptLocale,
  SummaryTemplateKey,
  SummaryTemplatesMap
} from '../types/summary-prompt.types'
import { isLegacyDefaultSummaryTemplate } from './summary-config-legacy-templates.util'

const TEMPLATE_KEYS: SummaryTemplateKey[] = ['weekly', 'monthly', 'quarterly', 'yearly']

/** Normalize UI / i18n language code to a summary prompt locale. */
export function resolveSummaryPromptLocale(locale?: string): SummaryPromptLocale {
  const normalized = (locale || 'zh').toLowerCase().replace('_', '-')
  if (normalized === 'system' || normalized === '') return 'zh'
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')) return 'zh-TW'
  if (normalized.startsWith('zh')) return 'zh'
  if (normalized.startsWith('ja')) return 'ja'
  if (normalized.startsWith('en')) return 'en'
  return 'en'
}

/**
 * 将 UI 语言落到 summary_config.promptLocale。
 * 外观/设置切语言时应写入，生成回忆时也可用 UI 语言覆盖，保证模板与提示词语言一致。
 */
export function withSummaryPromptLocaleFromUi(
  config: SummaryConfig | null | undefined,
  uiLanguage: string | null | undefined
): { config: SummaryConfig; promptLocale: SummaryPromptLocale; changed: boolean } {
  const promptLocale = resolveSummaryPromptLocale(uiLanguage ?? undefined)
  const changed = config?.promptLocale !== promptLocale
  return {
    config: { ...(config || {}), promptLocale },
    promptLocale,
    changed
  }
}

export function getDefaultSummaryTemplate(
  type: SummaryTemplateKey,
  locale: SummaryPromptLocale = 'zh'
): string {
  return DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE[locale][type]
}

/** Merge legacy flat `instructions` into per-locale map (legacy → zh). */
export function normalizeSummaryInstructionsByLocale(
  config?: SummaryConfig | null
): Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>> {
  const byLocale: Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>> = {
    ...(config?.instructionsByLocale ?? {})
  }
  if (config?.instructions && Object.keys(config.instructions).length > 0) {
    byLocale.zh = { ...byLocale.zh, ...config.instructions }
  }
  return byLocale
}

function getLocaleTemplateOverride(
  byLocale: Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>>,
  locale: SummaryPromptLocale,
  type: SummaryTemplateKey
): string | undefined {
  const value = byLocale[locale]?.[type]
  if (value === undefined || value === '') return undefined
  // Sticky old defaults (role block in template) → treat as unset so new format-only default applies.
  if (isLegacyDefaultSummaryTemplate(value, locale, type)) return undefined
  return value
}

export function resolveSummaryTemplatesForGeneration(
  config: SummaryConfig | null | undefined,
  locale?: string
): SummaryTemplatesMap {
  // 显式传入 locale 时优先（生成侧用当前 UI 语言覆盖）；否则用 config.promptLocale
  const promptLocale = (
    locale !== undefined && locale !== ''
      ? resolveSummaryPromptLocale(locale)
      : (config?.promptLocale ?? resolveSummaryPromptLocale(locale))
  ) as SummaryPromptLocale
  const byLocale = normalizeSummaryInstructionsByLocale(config)

  const resolved: SummaryTemplatesMap = {}
  for (const key of TEMPLATE_KEYS) {
    const localeOverride = getLocaleTemplateOverride(byLocale, promptLocale, key)
    if (localeOverride !== undefined) {
      resolved[key] = localeOverride
      continue
    }
    if (promptLocale === 'zh') {
      const legacy = config?.instructions?.[key]
      if (
        legacy !== undefined &&
        legacy !== '' &&
        !isLegacyDefaultSummaryTemplate(legacy, 'zh', key)
      ) {
        resolved[key] = legacy
        continue
      }
    }
    resolved[key] = getDefaultSummaryTemplate(key, promptLocale)
  }
  return resolved
}

/** Prefix line before raw diary data in the combined generation prompt. */
export const SUMMARY_RAW_DATA_PREFIX: Record<SummaryPromptLocale, string> = {
  zh: '以下是需要总结的原始数据：',
  en: 'Below is the raw data to summarize:',
  ja: '以下が要約対象の元データです：',
  'zh-TW': '以下是需要總結的原始資料：'
}

export function getSummaryRawDataPrefix(locale?: string): string {
  return SUMMARY_RAW_DATA_PREFIX[resolveSummaryPromptLocale(locale)]
}

/** Template text for the editor: locale override, else that locale's built-in default. */
export function getSummaryTemplateForEdit(
  byLocale: Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>>,
  promptLocale: SummaryPromptLocale,
  type: SummaryTemplateKey
): string {
  const localeOverride = getLocaleTemplateOverride(byLocale, promptLocale, type)
  if (localeOverride !== undefined) return localeOverride

  if (promptLocale === 'zh') {
    const legacy = byLocale.zh?.[type]
    if (legacy !== undefined && legacy !== '') return legacy
  }

  return getDefaultSummaryTemplate(type, promptLocale)
}
