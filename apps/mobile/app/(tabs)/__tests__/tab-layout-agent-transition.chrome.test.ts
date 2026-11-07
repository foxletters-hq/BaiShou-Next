import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootLayoutSrc = readFileSync(join(currentDir, '../../_layout.tsx'), 'utf8')
const tabLayoutSrc = readFileSync(join(currentDir, '../_layout.tsx'), 'utf8')
const settingsLayoutSrc = readFileSync(join(currentDir, '../../settings/_layout.tsx'), 'utf8')
const stackScreenLayoutSrc = readFileSync(
  join(currentDir, '../../../src/components/StackScreenLayout.tsx'),
  'utf8'
)
const fadeAnimSrc = readFileSync(
  join(currentDir, '../../../src/navigation/fadeStackAnimation.ts'),
  'utf8'
)
const themedNavSrc = readFileSync(
  join(currentDir, '../../../src/navigation/themedNavigation.ts'),
  'utf8'
)
const agentTabPath = join(currentDir, '../agent.tsx')
const legacyAgentLayoutPath = join(currentDir, '../agent/_layout.tsx')

describe('mobile tab bar agent transition structure', () => {
  it('tab layout configures fadeTabAnimation across all tabs', () => {
    expect(tabLayoutSrc).toContain('fadeTabAnimation')
    expect(tabLayoutSrc).toContain('...fadeTabAnimation')
    expect(tabLayoutSrc).toContain('name="agent"')
  })

  it('fadeTabAnimation merges FadeTransition with explicit timing and duration config', () => {
    expect(fadeAnimSrc).toContain('TransitionPresets.FadeTransition')
    expect(fadeAnimSrc).toContain('...TransitionPresets.FadeTransition')
    expect(fadeAnimSrc).toContain("animation: 'fade'")
    expect(fadeAnimSrc).toContain("animation: 'timing'")
    expect(fadeAnimSrc).toContain('duration: FADE_DURATION_MS')
  })

  it('preserves fadeStackAnimation and themed fade stack options across root and settings layout', () => {
    expect(fadeAnimSrc).toContain('fadeStackAnimation')
    expect(fadeAnimSrc).toContain("animation: 'fade'")
    expect(fadeAnimSrc).not.toContain('slideStackAnimation')
    expect(themedNavSrc).toContain('buildThemedFadeStackOptions')
    expect(settingsLayoutSrc).toContain('buildThemedFadeStackOptions')
    expect(rootLayoutSrc).toContain('themedFadeStackOptions')
    expect(stackScreenLayoutSrc).toContain('FadeIn')
  })

  it('agent tab is a flat tab screen without nested redundant native stack', () => {
    expect(existsSync(agentTabPath)).toBe(true)
    expect(existsSync(legacyAgentLayoutPath)).toBe(false)

    const agentTabSrc = readFileSync(agentTabPath, 'utf8')
    expect(agentTabSrc).toContain('AgentScreen')
    expect(agentTabSrc).not.toContain('<Stack')
    expect(agentTabSrc).not.toContain('createNativeStackNavigator')
  })
})
