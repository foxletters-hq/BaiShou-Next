import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AIProviderConfigForm.tsx'),
  'utf8'
)

describe('AIProviderConfigForm DeepSeek peak help chrome', () => {
  it('should show a help tooltip next to the official DeepSeek provider name', () => {
    expect(src).toContain('isDeepSeekOfficialProvider(providerId)')
    expect(src).toContain('ai_config.deepseek_peak_pricing_help')
    expect(src).toContain('以 DeepSeek 控制台账单为准')
    expect(src).toContain('<HelpTooltip')
  })

  it('should not render the manual add-model input row', () => {
    expect(src).not.toContain('handleAddCustomModel')
    expect(src).not.toContain('add_model_placeholder')
    expect(src).not.toContain('addModelSection')
  })
})
