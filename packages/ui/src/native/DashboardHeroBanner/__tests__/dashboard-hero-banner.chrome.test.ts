import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'DashboardHeroBanner.tsx'),
  'utf8'
)

describe('Native DashboardHeroBanner type chrome', () => {
  it('should keep the brand name and memories title in a single title line', () => {
    expect(src).toMatch(
      /\{t\('common\.app_title',\s*'白守'\)\}\s*·\s*\{t\('summary\.collective_memories_title',\s*'回忆'\)\}/
    )
    expect(src).toMatch(/title:[\s\S]*fontSize:\s*mobileTypography\.title\.fontSize/)
    expect(src).not.toContain('styles.eyebrow')
    expect(src).not.toContain('mobileTypography.display')
    expect(src).not.toContain('mobileTypography.caption')
  })
})
