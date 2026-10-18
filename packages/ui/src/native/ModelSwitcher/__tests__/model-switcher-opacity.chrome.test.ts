import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'ModelSwitcher.tsx'),
  'utf8'
)
const styles = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'model-switcher.styles.ts'),
  'utf8'
)

describe('native ModelSwitcher opacity chrome', () => {
  it('should close with a fade like other centered dialogs, without scaling', () => {
    expect(src).toContain('animationType="fade"')
    expect(src).toContain('colors.bgOverlay')
    expect(src).not.toContain('scaleAnim')
    expect(src).not.toContain('panelOpacity')
    expect(src).not.toContain('transform: [{ scale')
    expect(src).not.toContain('Animated.spring')
    expect(styles).not.toContain('rgba(0, 0, 0, 0.35)')
  })
})
