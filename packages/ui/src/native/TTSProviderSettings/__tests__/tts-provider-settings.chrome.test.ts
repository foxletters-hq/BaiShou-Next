import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const basicFieldsSrc = readFileSync(join(here, '../TtsBasicFields.tsx'), 'utf8')
const testSectionSrc = readFileSync(join(here, '../TtsGptSovitsFields.tsx'), 'utf8')
const stylesSrc = readFileSync(join(here, '../tts-provider-settings.styles.ts'), 'utf8')
const selectorStylesSrc = readFileSync(
  join(here, '../../SettingsSelector/settings-selector.styles.ts'),
  'utf8'
)
const tokensSrc = readFileSync(join(here, '../../../theme/tokens.ts'), 'utf8')
const ruleDocSrc = readFileSync(
  join(here, '../../../../../../docs/1-AI-Code/2-UI-Theme-Rule.md'),
  'utf8'
)

describe('TTS Provider Settings mobile styling & specification', () => {
  it('should define mobileControlTokens specification in tokens and doc', () => {
    expect(tokensSrc).toContain('mobileControlTokens')
    expect(tokensSrc).toContain('height: 40')
    expect(ruleDocSrc).toContain('mobileControlTokens')
    expect(ruleDocSrc).toContain('### 3.14 移动端表单控件与按钮规范')
  })

  it('should render TTS provider and model selectors with matching trigger styling', () => {
    expect(basicFieldsSrc).toContain('styles.providerSelectWrap')
    expect(basicFieldsSrc).toContain('styles.compactSelectTrigger')
    expect(stylesSrc).toMatch(/compactSelectTrigger:[\s\S]*minHeight:\s*32/)
    expect(stylesSrc).toMatch(
      /compactSelectTrigger:[\s\S]*paddingHorizontal:\s*sharedTokens\.spacing\.smPlus/
    )
  })

  it('should use mobileControlTokens specification for inputs and action buttons', () => {
    expect(stylesSrc).toContain('mobileControlTokens')
    expect(stylesSrc).toMatch(/input:[\s\S]*minHeight:\s*mobileControlTokens\.height/)
    expect(stylesSrc).toMatch(
      /input:[\s\S]*paddingVertical:\s*mobileControlTokens\.inputPaddingVertical/
    )
    expect(stylesSrc).toMatch(/actionButton:[\s\S]*minHeight:\s*mobileControlTokens\.height/)
    expect(stylesSrc).toMatch(/fetchModelsBtn:[\s\S]*minHeight:\s*mobileControlTokens\.height/)
    expect(selectorStylesSrc).toContain('mobileControlTokens')
    expect(selectorStylesSrc).toMatch(/trigger:[\s\S]*minHeight:\s*mobileControlTokens\.height/)
    expect(selectorStylesSrc).toMatch(
      /trigger:[\s\S]*paddingVertical:\s*mobileControlTokens\.inputPaddingVertical/
    )
  })

  it('should align action buttons with inputs in modelRow and testRow', () => {
    expect(basicFieldsSrc).toContain('styles.actionButton')
    expect(testSectionSrc).toContain('style={styles.actionButton}')
  })
})
