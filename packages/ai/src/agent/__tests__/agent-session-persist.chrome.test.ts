import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('agent session persist chrome', () => {
  it('should not warn limited persist when the stream was aborted', () => {
    const desktop = read('../agent-session-persist.ts')
    const native = read('../agent-session-persist.native.ts')
    expect(desktop).toContain('shouldWarnLimitedPersist')
    expect(desktop).toContain('shouldReadStreamUsageAfterInterrupt')
    expect(desktop).toContain('userAborted')
    expect(native).toContain('shouldWarnLimitedPersist')
    expect(native).toContain('shouldReadStreamUsageAfterInterrupt')
    expect(native).toContain('userAborted')
  })
})
