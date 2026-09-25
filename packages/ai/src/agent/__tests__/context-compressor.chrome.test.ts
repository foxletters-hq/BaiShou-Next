import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'context-compressor.service.ts'),
  'utf8'
)

describe('context compressor chrome', () => {
  it('should trigger resend compression from tokens since the last snapshot', () => {
    expect(src).toContain('countTokensSinceLastSnapshot')
    expect(src).toContain('estimateTokensSinceLastSnapshot')
    expect(src).toContain(
      'restoreSynthesizedFromMarkers: runOptions?.countTokensSinceLastSnapshot !== true'
    )
  })

  it('should apply first-output timeout to compression streams and rethrow it', () => {
    expect(src).toContain('runWithFirstOutputTimeout')
    expect(src).toContain('AGENT_STREAM_FIRST_OUTPUT_TIMEOUT_MS')
    expect(src).toContain('isAgentFirstOutputTimeoutError')
    expect(src).toContain('onFirstOutput: markFirstOutput')
  })
})
