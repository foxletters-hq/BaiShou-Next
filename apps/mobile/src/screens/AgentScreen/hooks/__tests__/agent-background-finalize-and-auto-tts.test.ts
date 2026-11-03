import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const interactionsSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../useAgentScreenInteractions.ts'),
  'utf8'
)

const bridgeSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../../hooks/useAgentStream-bridge.ts'),
  'utf8'
)

const finishSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../../hooks/useAgentStream-finish.ts'),
  'utf8'
)

const sessionSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../../hooks/useAgentSession.ts'),
  'utf8'
)

describe('mobile agent background finalization & auto tts', () => {
  it('triggers auto tts when streaming completes and ttsMode is always', () => {
    expect(interactionsSrc).toContain('awaitingAutoTtsRef')
    expect(interactionsSrc).toContain("ttsMode === 'always'")
    expect(interactionsSrc).toContain('handleTtsReadAloud(lastMsg.content, lastMsg.id)')
  })

  it('bypasses lingering reveal animations when app is in background in stream bridge', () => {
    expect(bridgeSrc).toContain("AppState.currentState !== 'active'")
    expect(bridgeSrc).toContain('stopAllAgentMarkdownRevealing()')
    expect(bridgeSrc).toContain("AppState.addEventListener('change'")
  })

  it('avoids delayed usage polling when finishing stream in background', () => {
    expect(finishSrc).toContain("AppState.currentState === 'active'")
    expect(finishSrc).toContain('stopAllAgentMarkdownRevealing()')
  })

  it('resyncs session messages when app returns to foreground without timeout hangs', () => {
    expect(sessionSrc).toContain("nextState === 'active'")
    expect(sessionSrc).toContain('refreshSessionMessages(currentSessionId, { preserveWindow: true })')
  })
})
