import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentChatList.tsx'),
  'utf8'
)
const stylesSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'agent-screen.styles.ts'),
  'utf8'
)

describe('AgentChatList timeline chrome', () => {
  it('should pass the live timeline and permission cards into the live assistant row', () => {
    expect(src).toContain('timeline:')
    expect(src).toContain('gateParts:')
    expect(src).toContain('p.liveStreamProps.timeline')
    expect(src).not.toContain('timeline: p.markdownPresentationActive')
  })

  it('should keep the scroll-to-bottom button mounted and toggle visibility with opacity', () => {
    expect(src).toContain('styles.scrollBtnWrap')
    expect(src).toContain('scrollButtonVisibilityStyle')
    expect(src).toContain("pointerEvents={scrollButtonVisible ? 'box-none' : 'none'}")
    expect(src).not.toContain('p.showScrollButton && !p.isBubbleEditing ? (')
  })

  it('should render the scroll-to-bottom button with a visible border and primary text icon contrast without shadow', () => {
    expect(src).toContain('p.colors.borderStrong')
    expect(src).toContain('p.colors.textPrimary')
    expect(src).not.toContain('shadowOpacity')
    expect(stylesSrc).toContain('borderWidth: 1')
    expect(stylesSrc).toContain('zIndex: 15')
    expect(stylesSrc).not.toContain('shadowColor')
    expect(stylesSrc).not.toContain('elevation')
  })
})
