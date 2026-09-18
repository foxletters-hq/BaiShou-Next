import { describe, expect, it } from 'vitest'
import { patchSummaryLocaleTemplates, patchSummarySystemPrompt } from '../summary-settings.util'

describe('patchSummaryLocaleTemplates', () => {
  it('should write the template text for the active locale and type when patching', () => {
    expect(patchSummaryLocaleTemplates({}, 'zh', 'weekly', 'hello')).toEqual({
      zh: { weekly: 'hello' }
    })
  })
})

describe('patchSummarySystemPrompt', () => {
  it('should keep other locales when writing one system prompt', () => {
    expect(patchSummarySystemPrompt({ en: 'keep' }, 'zh', 'next')).toEqual({
      en: 'keep',
      zh: 'next'
    })
  })
})
