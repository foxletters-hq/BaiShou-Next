import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'pricing', 'model-pricing.service.ts'),
  'utf8'
)

describe('ModelPricingService DeepSeek peak chrome', () => {
  it('should apply DeepSeek peak overlay when calculating micros', () => {
    expect(src).toContain('applyDeepSeekPeakCost(providerId, price.calculateCost(usage))')
  })
})
