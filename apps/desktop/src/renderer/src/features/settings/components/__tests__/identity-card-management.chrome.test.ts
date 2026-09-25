import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'IdentityCardManagementPane.tsx'),
  'utf8'
)

describe('IdentityCardManagementPane chrome', () => {
  it('should open the current card attributes in a dialog', () => {
    expect(src).toContain('IdentityFactsDialog')
    expect(src).toContain('identity_current_card')
    expect(src).toContain('setFactsPersonaId')
    expect(src).toContain('identity_tap_to_view')
  })
})
