import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'ChatCostDialog.tsx'),
  'utf8'
)

describe('native ChatCostDialog token grouping chrome', () => {
  it('should format cumulative input, output, and cache counts with locale grouping', () => {
    expect(src).toContain('formatLocaleTokenCount(details.promptTokens)')
    expect(src).toContain('formatLocaleTokenCount(details.completionTokens)')
    expect(src).toContain('formatLocaleTokenCount(details.cacheReadTokens!)')
    expect(src).not.toMatch(/\{details\.promptTokens\} \{t\('agent\.chat\.tokens_unit'/)
  })
})
