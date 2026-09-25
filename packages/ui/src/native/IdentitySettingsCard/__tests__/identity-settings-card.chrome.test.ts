import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('native IdentitySettingsCard chrome', () => {
  it('should navigate to identity management instead of expanding facts', () => {
    const src = readFileSync(join(here, '../IdentitySettingsCard.tsx'), 'utf8')
    expect(src).toContain('onManageIdentity')
    expect(src).toContain('identity_current_named')
    expect(src).not.toContain('IdentitySettingsFactsSection')
    expect(src).not.toContain('SettingsExpansionTile')
  })
})
