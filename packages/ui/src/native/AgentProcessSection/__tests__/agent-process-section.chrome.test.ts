import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentProcessSection.tsx'),
  'utf8'
)

describe('Native AgentProcessSection chrome', () => {
  it('supports hasPrecedingText prop and applies rootWithPrecedingText style', () => {
    expect(src).toContain('hasPrecedingText?: boolean')
    expect(src).toContain('hasPrecedingText = false')
    expect(src).toContain('hasPrecedingText ? styles.rootWithPrecedingText : null')
    expect(src).toContain('rootWithPrecedingText:')
    expect(src).toContain('markdownSpacingTokens.processAfterTextMarginTop')
  })
})
