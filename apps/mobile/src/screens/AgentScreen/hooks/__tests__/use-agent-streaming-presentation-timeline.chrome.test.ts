import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'useAgentStreamingPresentation.tsx'),
  'utf8'
)

describe('Mobile streaming presentation timeline chrome', () => {
  it('should pass the live timeline into ChatBubble and StreamingBubble', () => {
    expect(src).toContain('timeline')
    expect(src).toContain('liveStreamProps')
    expect(src).toContain('timeline,')
  })
})
