import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentChatList.tsx'),
  'utf8'
)

describe('AgentChatList gate chrome', () => {
  it('should only render resolved live gates for the current session', () => {
    expect(src).toContain('selectResolvedLiveForSession')
    expect(src).toContain("selectResolvedLiveForSession(state, p.currentSessionId, 'companion')")
    expect(src).toContain("collectAgentGatePartDataForSurface(msg.parts, 'companion')")
    expect(src).not.toContain('resolvedLiveAll')
    expect(src).not.toContain('!p.currentSessionId ||')
  })

  it('should restore an unresolved companion_ask into the inbox after persist', () => {
    expect(src).toContain('collectUnresolvedAgentGateRequestsForSurface')
    expect(src).toContain('upsertAsked')
  })
})
