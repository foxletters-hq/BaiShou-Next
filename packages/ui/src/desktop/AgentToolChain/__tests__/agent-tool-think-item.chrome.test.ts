import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentToolThinkItem.tsx'),
  'utf8'
)

describe('AgentToolThinkItem companion ask chrome', () => {
  it('should keep answered companion_ask inside the collapsible tool row', () => {
    expect(src).not.toContain('shouldRenderCompanionAskResultInList')
    expect(src).not.toContain('!askPresentation')
    expect(src).toContain('isCompanionAskAwaitingAnswer')
    expect(src).toContain('hasResult')
    expect(src).toContain('isLoading &&')
    expect(src).toContain('ToolResultContent')
  })

  it('should hide tool duration when persisted durationMs is 0', () => {
    expect(src).toContain('model.durationMs != null && model.durationMs > 0')
  })
})
