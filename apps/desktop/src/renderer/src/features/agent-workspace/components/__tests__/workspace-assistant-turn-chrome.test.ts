import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('workspace assistant turn chrome', () => {
  it('should parse think tags and fall back to message content when the timeline is empty', () => {
    const src = readFileSync(join(here, '../WorkspaceAssistantTurn.tsx'), 'utf8')
    expect(src).toContain('parseRedactedThinking')
    expect(src).toContain('fallbackParsed')
    expect(src).toContain('getWorkspaceAssistantText')
    expect(src).toContain('reply_interrupted')
  })
})
