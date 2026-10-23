import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../useAgentStream-chat.ts'),
  'utf8'
)

describe('useAgentStream-chat session vault chrome', () => {
  it('should persist a new companion session with the live vault id', () => {
    expect(src).toContain('resolveMobileActiveVaultId')
    expect(src).toContain('buildInsertSessionInput')
    expect(src).not.toMatch(/buildInsertSessionInput\([\s\S]*getActiveVaultNameForContext/)
  })
})
