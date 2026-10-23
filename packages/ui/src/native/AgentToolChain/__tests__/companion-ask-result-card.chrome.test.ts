import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'CompanionAskResultCard.tsx'),
  'utf8'
)

describe('CompanionAskResultCard', () => {
  it('should page multi-question answers instead of stacking them', () => {
    expect(cardSource).toContain('data.items')
    expect(cardSource).toContain('CompanionAskResultItem')
    expect(cardSource).toContain('queue_prev')
    expect(cardSource).toContain('queue_next')
    expect(cardSource).toContain('ask_progress')
  })
})
