import { describe, expect, it } from 'vitest'
import { LEGACY_DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE } from '../../constants/summary-templates/legacy-default-summary-templates'
import { getDefaultSummaryTemplate } from '../summary-template.util'
import {
  isLegacyDefaultSummaryTemplate,
  stripLegacyDefaultSummaryTemplates,
  migrateSummaryConfigLegacyTemplates
} from '../summary-config-legacy-templates.util'

describe('summary-config-legacy-templates', () => {
  it('detects sticky pre-role-split default templates', () => {
    expect(
      isLegacyDefaultSummaryTemplate(
        LEGACY_DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE.zh.weekly,
        'zh',
        'weekly'
      )
    ).toBe(true)
    expect(isLegacyDefaultSummaryTemplate(getDefaultSummaryTemplate('weekly', 'zh'), 'zh', 'weekly')).toBe(
      false
    )
    expect(isLegacyDefaultSummaryTemplate('我自定义的周结模板', 'zh', 'weekly')).toBe(false)
  })

  it('strips legacy defaults and keeps custom templates', () => {
    const { config, changed } = stripLegacyDefaultSummaryTemplates({
      instructionsByLocale: {
        zh: {
          weekly: LEGACY_DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE.zh.weekly,
          monthly: '我的月结'
        },
        en: {
          weekly: LEGACY_DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE.en.weekly
        }
      },
      instructions: {
        quarterly: LEGACY_DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE.zh.quarterly,
        yearly: '自定义年结'
      }
    })

    expect(changed).toBe(true)
    expect(config.instructionsByLocale?.zh?.weekly).toBeUndefined()
    expect(config.instructionsByLocale?.zh?.monthly).toBe('我的月结')
    expect(config.instructionsByLocale?.en).toBeUndefined()
    expect(config.instructions?.quarterly).toBeUndefined()
    expect(config.instructions?.yearly).toBe('自定义年结')
  })

  it('is a no-op when nothing matches legacy defaults', () => {
    const input = {
      instructionsByLocale: {
        zh: { weekly: 'custom' }
      }
    }
    const { config, changed } = stripLegacyDefaultSummaryTemplates(input)
    expect(changed).toBe(false)
    expect(config).toBe(input)
  })

  it('migrateSummaryConfigLegacyTemplates persists when changed', async () => {
    const store = {
      data: {
        summary_config: {
          instructionsByLocale: {
            zh: { weekly: LEGACY_DEFAULT_SUMMARY_TEMPLATES_BY_LOCALE.zh.weekly }
          }
        }
      } as Record<string, unknown>,
      async get<T>(key: string) {
        return (this.data[key] as T) ?? null
      },
      async set<T>(key: string, value: T) {
        this.data[key] = value
      }
    }

    expect(await migrateSummaryConfigLegacyTemplates(store)).toBe(true)
    const saved = store.data.summary_config as {
      instructionsByLocale?: Record<string, unknown>
    }
    expect(saved.instructionsByLocale).toBeUndefined()
    expect(await migrateSummaryConfigLegacyTemplates(store)).toBe(false)
  })
})
