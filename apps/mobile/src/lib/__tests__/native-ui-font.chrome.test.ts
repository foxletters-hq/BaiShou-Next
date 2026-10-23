import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const mobileRoot = join(here, '../../..')

describe('mobile native ui font chrome', () => {
  it('should not embed or name a custom ui typeface', () => {
    const appJson = readFileSync(join(mobileRoot, 'app.json'), 'utf8')
    expect(appJson).not.toContain('withNativeUiFonts')
    expect(existsSync(join(mobileRoot, 'plugins/withNativeUiFonts.js'))).toBe(false)

    const packageJson = readFileSync(join(mobileRoot, 'package.json'), 'utf8')
    expect(packageJson).not.toContain('@expo-google-fonts/')

    const layout = readFileSync(join(mobileRoot, 'app/_layout.tsx'), 'utf8')
    expect(layout).not.toContain('loadAndApplyNativeUiFont')
    expect(layout.indexOf('<DialogProvider>')).toBeGreaterThan(-1)
    expect(layout.indexOf('<HeroUIThemeBridge>')).toBeLessThan(layout.indexOf('<DialogProvider>'))
    expect(layout.lastIndexOf('</DialogProvider>')).toBeLessThan(
      layout.lastIndexOf('</HeroUIThemeBridge>')
    )

    const bridge = readFileSync(join(mobileRoot, 'src/providers/NativeAppThemeBridge.tsx'), 'utf8')
    expect(bridge).not.toContain('nativeUiFontFamilyFromLanguage')
    expect(bridge).not.toContain('uiFontFamily')

    const themeCss = readFileSync(join(mobileRoot, 'styles/baishou-heroui-theme.css'), 'utf8')
    expect(themeCss).not.toContain('Noto Sans')
    expect(themeCss).not.toMatch(/--font-sans\s*:/)
  })
})
