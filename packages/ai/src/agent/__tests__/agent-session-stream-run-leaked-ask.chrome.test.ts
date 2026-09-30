import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../agent-session-stream-run.ts'),
  'utf8'
)

describe('agent session stream leaked companion_ask chrome', () => {
  it('should open companion_ask when the model writes the tool as XML text', () => {
    expect(src).toContain('extractLeakedCompanionAsk')
    expect(src).toContain('leaked-companion-ask')
  })
})
