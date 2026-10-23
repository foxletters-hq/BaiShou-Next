import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'SummaryGenerationCard.tsx'),
  'utf8'
)

describe('mobile summary generation card chrome', () => {
  it('should inset the partner picker scroll indicator like skill cite preview', () => {
    expect(src).toContain('paddingRight: sharedTokens.spacing.mdTight')
  })
})
