import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-session-context.ts'),
  'utf8'
)

describe('agent session context chrome', () => {
  it('should only re-evaluate compression on resend when a snapshot remains', () => {
    expect(src).toContain('shouldEvaluateCompressionAfterResend')
    expect(src).toContain('hasCompressionSnapshot: Boolean(snapshotForWindow)')
    expect(src).not.toContain('force: true')
  })

  it('should trigger resend compression from tokens since the last snapshot', () => {
    expect(src).toContain('shouldCountTokensSinceLastSnapshot')
    expect(src).toContain('estimateTokensSinceLastSnapshot')
    expect(src).toContain('countTokensSinceLastSnapshot')
    expect(src).toContain('restoreSynthesizedFromMarkers: forceRecompress !== true')
  })

  it('should not wait for diary confirmation before auto-compressing a chat turn', () => {
    expect(src).not.toContain('await saveDiaryBeforeCompression(sessionMessages)')
  })
})
