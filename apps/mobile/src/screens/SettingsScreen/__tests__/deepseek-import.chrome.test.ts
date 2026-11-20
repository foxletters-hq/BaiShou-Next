import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mobileRoot = resolve(__dirname, '../../../..')

describe('DeepSeek import mobile entry & UI chrome', () => {
  it('should register /settings/deepseek-import in settingsHubItems under data group', () => {
    const hubSrc = readFileSync(
      resolve(mobileRoot, 'src/screens/SettingsScreen/settingsHubItems.ts'),
      'utf8'
    )
    expect(hubSrc).toContain("'/settings/deepseek-import'")
    expect(hubSrc).toContain("id: 'deepseek-import'")
    expect(hubSrc).toContain("titleKey: 'deepseek_import.entry_title'")
    expect(hubSrc).toContain("brandProviderId: 'deepseek'")
  })

  it('should register deepseek-import route and stack screen', () => {
    const layoutSrc = readFileSync(resolve(mobileRoot, 'app/settings/_layout.tsx'), 'utf8')
    const routeSrc = readFileSync(resolve(mobileRoot, 'app/settings/deepseek-import.tsx'), 'utf8')
    expect(layoutSrc).toContain('<Stack.Screen name="deepseek-import" />')
    expect(routeSrc).toContain('DeepSeekImportScreen')
  })

  it('should use official @baishou/ui/native controls for target switching and session selection', () => {
    const screenSrc = readFileSync(
      resolve(mobileRoot, 'src/screens/SettingsScreen/DeepSeekImportScreen.tsx'),
      'utf8'
    )
    const targetSrc = readFileSync(
      resolve(mobileRoot, 'src/screens/SettingsScreen/components/DeepSeekImportTargetCard.tsx'),
      'utf8'
    )
    const listSrc = readFileSync(
      resolve(
        mobileRoot,
        'src/screens/SettingsScreen/components/DeepSeekImportSessionListCard.tsx'
      ),
      'utf8'
    )

    const settingsSrc = readFileSync(
      resolve(mobileRoot, 'src/screens/SettingsScreen/SettingsScreen.tsx'),
      'utf8'
    )

    expect(screenSrc).toContain('ProviderBrandIcon')
    expect(screenSrc).toContain('monochrome')
    expect(screenSrc).toContain('ModelSwitcher')
    expect(settingsSrc).toContain('monochrome')
    expect(screenSrc).toContain('RestoreBlockingOverlay')
    expect(targetSrc).toContain('SegmentedControl')
    expect(targetSrc).toContain('SegmentedContent')
    expect(targetSrc).toContain('AssistantAvatarPicker')
    expect(targetSrc).toContain('AssistantKindTabBar')
    expect(targetSrc).toContain('agent.assistant.prompt_label')
    expect(targetSrc).toContain('agent.assistant.bind_model_label')
    expect(targetSrc).toContain('Input')
    expect(targetSrc).not.toContain('<Select')
    expect(listSrc).toContain('Checkbox')
    expect(listSrc).toContain('start_import_button')
    expect(listSrc.indexOf('selectAllBtn')).toBeLessThan(listSrc.indexOf('start_import_button'))
  })

  it('should settle StackScreenLayout opacity to static 1 and mount modals outside Animated.View', () => {
    const layoutSrc = readFileSync(
      resolve(mobileRoot, 'src/components/StackScreenLayout.tsx'),
      'utf8'
    )
    const screenSrc = readFileSync(
      resolve(mobileRoot, 'src/screens/SettingsScreen/DeepSeekImportScreen.tsx'),
      'utf8'
    )
    const hookSrc = readFileSync(resolve(mobileRoot, 'src/hooks/useDeepSeekImport.ts'), 'utf8')

    // StackScreenLayout 淡入完成后应切回静态 opacity: 1，防止 Android Fabric 覆写回 opacity: 0
    expect(layoutSrc).toContain('fadeCompleted ? styles.contentVisible : animatedContentStyle')
    expect(layoutSrc).toContain('contentVisible: { opacity: 1 }')

    // Modal 类浮层应挂在 StackScreenLayout 之外，避免与内容区 Animated.View 互相干扰
    const layoutOpenIdx = screenSrc.indexOf('<StackScreenLayout')
    const layoutCloseIdx = screenSrc.indexOf('</StackScreenLayout>')
    const overlayIdx = screenSrc.indexOf('<RestoreBlockingOverlay')
    const switcherIdx = screenSrc.indexOf('<ModelSwitcher')
    expect(overlayIdx).toBeGreaterThan(-1)
    expect(overlayIdx).toBeLessThan(layoutOpenIdx)
    expect(switcherIdx).toBeGreaterThan(layoutCloseIdx)

    // DocumentPicker 与扫描过程均须受 try/catch 保护并记录诊断日志
    expect(hookSrc).toContain('[DeepSeekImport] pick:start')
    expect(hookSrc).toContain('[DeepSeekImport] scan:done')
  })
})
