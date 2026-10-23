import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentDrawer.tsx'),
  'utf8'
)

const currentCardStyle = src.slice(src.indexOf('currentCard: {'), src.indexOf('currentMeta: {'))

describe('AgentDrawer current partner card chrome', () => {
  it('should use a muted border without elevation when the sidebar shows the current partner', () => {
    expect(src).toContain('borderColor: colors.borderMuted')
    expect(currentCardStyle).toContain('borderWidth: 1')
    expect(currentCardStyle).not.toContain('shadowColor')
    expect(currentCardStyle).not.toContain('shadowOpacity')
    expect(currentCardStyle).not.toContain('elevation')
  })

  it('should extend drawer to screen top and apply safe area inset with breathing room', () => {
    expect(src).toContain('top: 0')
    expect(src).not.toContain('top: insets.top')
    expect(src).toContain('paddingTop: Math.max(insets.top, 0) + sharedTokens.spacing.smPlus')
    expect(src).toContain('statusBarTranslucent')
    expect(src).toContain('<StatusBar')
  })
})
