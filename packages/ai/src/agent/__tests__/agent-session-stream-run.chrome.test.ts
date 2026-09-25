import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-session-stream-run.ts'),
  'utf8'
)

describe('agent session stream run chrome', () => {
  it('should wrap each model turn with a first-output timeout', () => {
    expect(src).toContain('runWithFirstOutputTimeout')
    expect(src).toContain('AGENT_STREAM_FIRST_OUTPUT_TIMEOUT_MS')
    expect(src).toContain('onFirstOutput')
    expect(src).toContain('isAgentFirstOutputTimeoutError')
    expect(src).toContain('abortAgentStreamSession(sessionId, options.streamClaimGeneration)')
  })

  it('should keep an unexpected abort as streamError so finish can report it', () => {
    expect(src).toContain('isAgentStreamAbortError(error)')
  })

  it('should flush the checkpoint when a companion_ask gate is asked', () => {
    expect(src).toContain("event.type !== 'agent_gate.asked'")
    expect(src).toContain("assistantCheckpoint.schedule('tool')")
  })

  it('should open companion_ask as soon as the streamed tool input contains a question', () => {
    expect(src).toContain('startCompanionAskFromStreamInput(enabledTools, chunk, sessionId)')
    expect(src).toContain('waitCompanionAskInflight(sessionId)')
  })

  it('should count doom-loop fingerprints after a tool returns, not when it starts', () => {
    expect(src).toContain('createDoomLoopCallGate')
    expect(src).toContain('doomCallGate.onToolCall(chunk)')
    expect(src).toContain('doomCallGate.onToolResult(chunk.toolCallId)')
  })

  it('should keep streaming when a doom-loop fingerprint repeats instead of aborting the round', () => {
    expect(src).toContain('attachDoomLoopObserver')
    expect(src).not.toContain('onTripped:')
    expect(src).not.toContain('doomTripped = true')
  })
})
