import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '../ContextMenu.tsx'), 'utf8')

describe('native ContextMenu chrome', () => {
  it('should paint a compact flat anchored menu without elevation', () => {
    expect(source).toContain('backgroundColor: colors.bgSurface')
    expect(source).toContain('borderColor: colors.borderMuted')
    expect(source).not.toContain('getNativeElevationStyle')
    expect(source).not.toContain('colors.bgSurfaceHighest')
    expect(source).toMatch(/menuLabel:[\s\S]*mobileTypography\.secondary\.fontSize/)
    expect(source).toMatch(/menuItem:[\s\S]*paddingVertical: sharedTokens\.spacing\.sm/)
    expect(source).toMatch(/menuItem:[\s\S]*paddingHorizontal: sharedTokens\.spacing\.mdTight/)
  })

  it('should fill the screen so nested modals do not center the menu', () => {
    expect(source).toContain('StyleSheet.absoluteFillObject')
    expect(source).toContain('statusBarTranslucent')
    expect(source).toContain('presentationStyle="overFullScreen"')
    expect(source).toContain('<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />')
  })

  it('should place itself from the trigger layout and compensate Android modal inset', () => {
    expect(source).toContain('triggerLayout')
    expect(source).toContain('computeAnchoredMenuPosition')
    expect(source).toContain("Platform.OS === 'android'")
    expect(source).toContain('insets.top')
    expect(source).toContain('onLayout={handleMenuLayout}')
    expect(source).toContain("placement: 'side'")
  })
})
