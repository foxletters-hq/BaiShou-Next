import { LEGACY_DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE } from '../constants/summary-templates/legacy-default-summary-templates'
import { DEFAULT_SUMMARY_GENERATION_SYSTEM_PROMPTS } from '../constants/summary-generation-system-prompt.defaults'
import type { SummaryConfig } from '../types/settings.types'
import type {
  SummaryPromptLocale,
  SummaryTemplateKey,
  SummaryTemplatesMap
} from '../types/summary-prompt.types'
import { SUMMARY_PROMPT_LOCALES } from '../types/summary-prompt.types'

const TEMPLATE_KEYS: SummaryTemplateKey[] = ['weekly', 'monthly', 'quarterly', 'yearly']

function sameTemplateText(a: string | undefined, b: string | undefined): boolean {
  if (a == null || b == null) return false
  return a.trim() === b.trim()
}

export function isLegacyDefaultSummaryTemplate(
  text: string | null | undefined,
  locale: SummaryPromptLocale,
  type: SummaryTemplateKey
): boolean {
  if (text == null || !text.trim()) return false
  return sameTemplateText(text, LEGACY_DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE[locale][type])
}

function stripLegacyFromLocaleMap(
  map: SummaryTemplatesMap | undefined,
  locale: SummaryPromptLocale
): { map: SummaryTemplatesMap | undefined; changed: boolean } {
  if (!map) return { map, changed: false }
  let changed = false
  const next: SummaryTemplatesMap = { ...map }
  for (const key of TEMPLATE_KEYS) {
    const value = next[key]
    if (value != null && isLegacyDefaultSummaryTemplate(value, locale, key)) {
      delete next[key]
      changed = true
    }
  }
  if (TEMPLATE_KEYS.every((key) => next[key] == null || next[key] === '')) {
    return { map: undefined, changed }
  }
  return { map: next, changed }
}

/**
 * Clear persisted summary templates that still equal the pre-role-split defaults,
 * so runtime falls through to the new format-only built-in templates.
 * Also clears sticky system prompts that equal the current built-in defaults.
 */
export function stripLegacyDefaultSummaryTemplates(config: SummaryConfig): {
  config: SummaryConfig
  changed: boolean
} {
  let changed = false
  const instructionsByLocale: Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>> = {
    ...(config.instructionsByLocale ?? {})
  }

  for (const locale of SUMMARY_PROMPT_LOCALES) {
    const stripped = stripLegacyFromLocaleMap(instructionsByLocale[locale], locale)
    if (stripped.changed) {
      changed = true
      if (stripped.map) {
        instructionsByLocale[locale] = stripped.map
      } else {
        delete instructionsByLocale[locale]
      }
    }
  }

  let instructions = config.instructions ? { ...config.instructions } : undefined
  if (instructions) {
    const strippedZh = stripLegacyFromLocaleMap(instructions, 'zh')
    if (strippedZh.changed) {
      changed = true
      instructions = strippedZh.map
    }
  }

  let customGenerationSystemPromptByLocale = config.customGenerationSystemPromptByLocale
    ? { ...config.customGenerationSystemPromptByLocale }
    : undefined
  if (customGenerationSystemPromptByLocale) {
    for (const locale of SUMMARY_PROMPT_LOCALES) {
      const stored = customGenerationSystemPromptByLocale[locale]
      if (
        stored != null &&
        sameTemplateText(stored, DEFAULT_SUMMARY_GENERATION_SYSTEM_PROMPTS[locale])
      ) {
        delete customGenerationSystemPromptByLocale[locale]
        changed = true
      }
    }
    if (Object.keys(customGenerationSystemPromptByLocale).length === 0) {
      customGenerationSystemPromptByLocale = undefined
    }
  }

  if (!changed) {
    return { config, changed: false }
  }

  const next: SummaryConfig = { ...config }
  if (Object.keys(instructionsByLocale).length > 0) {
    next.instructionsByLocale = instructionsByLocale
  } else {
    delete next.instructionsByLocale
  }
  if (instructions && Object.keys(instructions).length > 0) {
    next.instructions = instructions
  } else {
    delete next.instructions
  }
  if (customGenerationSystemPromptByLocale) {
    next.customGenerationSystemPromptByLocale = customGenerationSystemPromptByLocale
  } else {
    delete next.customGenerationSystemPromptByLocale
  }
  return { config: next, changed: true }
}

export interface SummaryConfigSettingsStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
}

/** Persist cleared legacy default templates on upgrade. @returns whether SQLite was written. */
export async function migrateSummaryConfigLegacyTemplates(
  store: SummaryConfigSettingsStore
): Promise<boolean> {
  const raw = (await store.get<SummaryConfig>('summary_config')) || {}
  const { config, changed } = stripLegacyDefaultSummaryTemplates(raw)
  if (!changed) return false
  await store.set('summary_config', config)
  return true
}
