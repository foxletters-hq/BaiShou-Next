import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('agent composer chrome', () => {
  it('should render the model switcher in bottomLeading and usage ring in bottomTrailing', () => {
    const screen = [read('../AgentScreen.tsx'), read('../AgentCompanionGateDock.tsx')].join('\n')
    expect(screen).toContain('bottomLeading={modelSwitcherButton}')
    expect(screen).toContain('bottomTrailing={tokenUsageRing}')
    expect(screen).toContain('SessionContextUsageRing')
  })

  it('should refresh the gate inbox when companion_ask is waiting without a dock', () => {
    const screen = [read('../AgentScreen.tsx'), read('../AgentCompanionGateDock.tsx')].join('\n')
    expect(screen).toContain('refreshDesktopAgentGateInbox')
    expect(screen).toContain('askingCallIds')
    expect(screen).toContain('setInterval')
  })

  it('should rebuild the ask card from live timeline arguments instead of caching the array reference', () => {
    const screen = [read('../AgentScreen.tsx'), read('../AgentCompanionGateDock.tsx')].join('\n')
    expect(screen).toContain('resolveCompanionAskDockRequest')
    expect(screen).toContain('waitForLiveCompanionAskRequest')
    expect(screen).not.toContain('[flow.sessionId, flow.stream.timeline, pendingGate]')
  })

  it('should not keep the composer in stop state after a finished assistant reply', () => {
    const screen = [read('../AgentScreen.tsx'), read('../AgentCompanionGateDock.tsx')].join('\n')
    expect(screen).toContain('resolveCompanionStreamUi')
    expect(screen).toContain('isLoading={companionStreamUi.composerBusy}')
    expect(screen).not.toContain('isLoading={flow.stream.isStreaming || flow.stream.isCompressing}')
  })
})
