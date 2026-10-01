import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentChatList.tsx'),
  'utf8'
)

describe('AgentChatList timeline chrome', () => {
  it('should pass the live timeline and permission cards into the live assistant row', () => {
    expect(src).toContain('timeline:')
    expect(src).toContain('gateParts:')
    expect(src).toContain('p.liveStreamProps.timeline')
  })
})
