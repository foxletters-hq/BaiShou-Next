import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const card = readFileSync(join(here, '..', 'ChatBackgroundSettingsCard.tsx'), 'utf8')
const cardCss = readFileSync(join(here, '..', 'ChatBackgroundSettingsCard.css'), 'utf8')
const bubbleCss = readFileSync(join(here, '../../ChatBubble/ChatBubble.module.css'), 'utf8')
const streamingCss = readFileSync(
  join(here, '../../StreamingBubble/StreamingBubble.module.css'),
  'utf8'
)
const themeTokens = readFileSync(join(here, '../../../theme/css-variables.css'), 'utf8')

describe('desktop ChatBackgroundSettingsCard chrome', () => {
  it('opens a modal instead of expanding inline with SettingsExpansionTile', () => {
    expect(card).not.toContain('SettingsExpansionTile')
    expect(card).toContain('<Modal')
    expect(card).toContain('setModalOpen(true)')
    expect(card).toContain('chat-bg-modal')
  })

  it('aligns the clear-background action to the right', () => {
    expect(card).toContain('chat-bg-reset-row')
    expect(cardCss).toMatch(/\.chat-bg-reset-row \{[\s\S]*justify-content: flex-end/)
  })

  it('matches mobile bubble opacity over a custom background', () => {
    for (const css of [bubbleCss, streamingCss]) {
      expect(css).toContain('var(--chat-bubble-over-bg)')
      expect(css).toContain('var(--chat-bubble-over-border)')
    }
    expect(themeTokens).toContain('--chat-bubble-over-bg: rgba(255, 255, 255, 0.88)')
    expect(themeTokens).toContain('--chat-bubble-over-bg: rgba(32, 33, 37, 0.85)')
  })
})
