import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const desktopRoot = resolve(__dirname, '../../../../../../..')

describe('Desktop DeepSeek import entry, IPC, and UI chrome', () => {
  it('wires IPC registration, preload API, and renderer settings navigation', () => {
    const mainIndexSrc = readFileSync(resolve(desktopRoot, 'src/main/index.ts'), 'utf8')
    const preloadIndexSrc = readFileSync(resolve(desktopRoot, 'src/preload/index.ts'), 'utf8')
    const tabsSrc = readFileSync(
      resolve(desktopRoot, 'src/renderer/src/features/settings/settings-tabs.util.ts'),
      'utf8'
    )
    const shellSrc = readFileSync(
      resolve(desktopRoot, 'src/renderer/src/features/settings/SettingsShell.tsx'),
      'utf8'
    )
    const contentSrc = readFileSync(
      resolve(desktopRoot, 'src/renderer/src/features/settings/SettingsContentView.tsx'),
      'utf8'
    )

    expect(mainIndexSrc).toContain('registerDeepSeekImportIPC()')
    expect(preloadIndexSrc).toContain('deepSeekImportApi')
    expect(tabsSrc).toContain("'deepseek-import'")
    expect(shellSrc).toContain('deepseek_import.entry_title')
    expect(shellSrc).toContain('<DeepSeekMonoIcon')
    expect(shellSrc).not.toContain('maskImage')
    expect(contentSrc).toContain("case 'deepseek-import':")
    expect(contentSrc).toContain('<DeepSeekImportPane />')
  })

  it('uses @baishou/ui controls, inline monochrome SVG icon, and places start import button right of select-all', () => {
    const paneSrc = readFileSync(
      resolve(desktopRoot, 'src/renderer/src/features/settings/components/DeepSeekImportPane.tsx'),
      'utf8'
    )
    const iconSrc = readFileSync(
      resolve(desktopRoot, 'src/renderer/src/features/settings/components/DeepSeekMonoIcon.tsx'),
      'utf8'
    )
    const canonicalSvg = readFileSync(
      resolve(desktopRoot, '../../packages/ui/src/assets/ai_provider_icon/deepseek.svg'),
      'utf8'
    )
    const targetSrc = readFileSync(
      resolve(
        desktopRoot,
        'src/renderer/src/features/settings/components/DeepSeekImportTargetSection.tsx'
      ),
      'utf8'
    )
    const sessionListSrc = readFileSync(
      resolve(
        desktopRoot,
        'src/renderer/src/features/settings/components/DeepSeekImportSessionListSection.tsx'
      ),
      'utf8'
    )

    expect(paneSrc).toContain('SettingsPageChrome')
    expect(paneSrc).toContain('RestoreBlockingOverlay')
    expect(paneSrc).toContain('ModelSwitcherPopup')
    expect(paneSrc).toContain('<DeepSeekMonoIcon')
    expect(paneSrc).not.toContain('maskImage')

    const canonicalPathMatch = canonicalSvg.match(/<path d="([^"]+)"/)
    expect(canonicalPathMatch?.[1]).toBeTruthy()
    expect(iconSrc).toContain(`d="${canonicalPathMatch?.[1]}"`)

    expect(targetSrc).toContain('SegmentedControl')
    expect(targetSrc).toContain('AssistantAvatarPicker')
    expect(targetSrc).toContain('AssistantKindTabBar')
    expect(targetSrc).toContain('fieldSize="small"')

    expect(sessionListSrc).toContain('Checkbox')
    expect(sessionListSrc).toContain('start_import_button')
    expect(sessionListSrc.indexOf('selectAllLabel')).toBeLessThan(
      sessionListSrc.indexOf('start_import_button')
    )
  })
})
