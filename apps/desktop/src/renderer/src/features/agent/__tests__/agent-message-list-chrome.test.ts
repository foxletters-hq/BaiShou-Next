import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '../components/AgentMessageList.tsx'), 'utf8')
const css = readFileSync(join(here, '../AgentScreen.module.css'), 'utf8')

describe('AgentMessageList chrome', () => {
  it('should only render companion-scoped gate cards for the current session', () => {
    expect(src).toContain('selectResolvedLiveForSession')
    expect(src).toContain("selectResolvedLiveForSession(state, sessionId, 'companion')")
    expect(src).toContain("collectAgentGatePartDataForSurface(msg.parts, 'companion')")
    expect(src).not.toContain('resolvedLiveAll')
    expect(src).not.toContain(': resolvedLiveAll')
    expect(src).not.toContain("'workspace'")
  })

  it('should surface a stream error on the live bubble instead of the previous assistant turn', () => {
    expect(src).toContain('error={stream.error}')
    expect(src).toContain('error: stream.error')
    expect(src).toContain('resolvePersistedAssistantStreamError')
    expect(src).toContain('liveBubbleVisible: showStreamingBubble')
  })

  it('should pass the live timeline and persisted parts so assistant turns keep think/tool order', () => {
    expect(src).toContain('timeline={stream.timeline}')
    expect(src).toContain('parts: msg.parts')
  })

  it('should keep a live permission confirmation inside the streaming bubble', () => {
    expect(src).toContain('gateParts={liveGateParts}')
    expect(src).not.toContain('<AgentGatePartBubble')
  })

  it('should restore an unresolved companion_ask only while the live gate still has it', () => {
    expect(src).toContain('collectUnresolvedAgentGateRequestsForSurface')
    expect(src).toContain('listPending')
    expect(src).toContain('respectTombstone: true')
    expect(src).toContain('if (!liveIds.has(request.id)) continue')
  })

  it('should hide a persisted in-progress assistant while the live stream is still showing', () => {
    expect(src).toContain('resolveCompanionStreamUi')
    expect(src).toContain('hidePersistedLiveTurn')
    expect(src).toContain('showStreamingBubble')
  })

  it('should pin a short thread above the composer instead of stretching the column', () => {
    const contentRule = css.slice(
      css.indexOf('.messageContent {'),
      css.indexOf('.compressionAnchor {')
    )
    expect(contentRule).toContain('margin-top: auto')
    expect(contentRule).not.toContain('min-height: 100%')
    expect(contentRule).not.toMatch(/^\s*flex:\s*1\s*;/m)
  })
})
