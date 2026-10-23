import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'mobile-summary-generate-options.ts'), 'utf8')

describe('mobile summary identity injection', () => {
  it('injects the user nickname, identity card, and companion name into the system prompt', () => {
    expect(src).toContain('buildSummaryIdentitySystemPrompt')
    expect(src).toContain('formatUserCardFromProfile')
    expect(src).toContain('getUserProfileFromSettings')
    expect(src).toContain('userName: profile.nickname')
    expect(src).toContain('userCard: formatUserCardFromProfile(profile)')
    expect(src).toContain('companionName')
    expect(src).toContain('identitySystemPrompt')
  })
})
