import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const mobileRoot = join(here, '../../..')

describe('mobile native ui font chrome', () => {
  it('should embed source-han via native plugin and theme token, not jsx patch', () => {
    const appJson = readFileSync(join(mobileRoot, 'app.json'), 'utf8')
    expect(appJson).toContain('withNativeUiFonts.js')
    const layout = readFileSync(join(mobileRoot, 'app/_layout.tsx'), 'utf8')
    expect(layout).not.toContain('react/jsx-runtime')
    expect(layout).not.toContain('loadAndApplyNativeUiFont')
    const bridge = readFileSync(join(mobileRoot, 'src/providers/NativeAppThemeBridge.tsx'), 'utf8')
    expect(bridge).toContain('nativeUiFontFamilyFromLanguage')
    expect(bridge).toContain('uiFontFamily')
    const themeCss = readFileSync(join(mobileRoot, 'styles/baishou-heroui-theme.css'), 'utf8')
    expect(themeCss).toContain("--font-sans: 'Noto Sans SC'")
  })
})
