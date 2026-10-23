import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-vault-diary-stack.helpers.ts'),
  'utf8'
)

describe('mobile vault diary stack uses the registry vault id for shadow index', () => {
  it('should align leftover name-keyed journals then open the shadow repo with vault id', () => {
    expect(src).toContain('alignShadowJournalVaultId')
    expect(src).toContain(
      'new ShadowIndexRepository(shadowConnectionManager.getDb(), activeVault.id)'
    )
    expect(src).not.toContain(
      'new ShadowIndexRepository(shadowConnectionManager.getDb(), activeVault.name)'
    )
  })
})
