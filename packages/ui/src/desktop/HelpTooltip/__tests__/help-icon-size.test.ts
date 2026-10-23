import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { HELP_ICON_SIZE } from '../../../shared/icons/icon-sizes'

const here = dirname(fileURLToPath(import.meta.url))

describe('help icon size', () => {
  it('locks desktop and native help icons to HELP_ICON_SIZE', () => {
    expect(HELP_ICON_SIZE).toBe(16)
    const tooltip = readFileSync(join(here, '../index.tsx'), 'utf8')
    const button = readFileSync(join(here, '../SettingsHelpIconButton.tsx'), 'utf8')
    const native = readFileSync(join(here, '../../../native/Tooltip/HelpTooltip.tsx'), 'utf8')
    expect(tooltip).toContain('size={HELP_ICON_SIZE}')
    expect(button).toContain('size={HELP_ICON_SIZE}')
    expect(native).toContain('size={HELP_ICON_SIZE}')
  })

  it('keeps the clickable help control a square circle so focus/hover is not an oval', () => {
    const css = readFileSync(join(here, '../SettingsHelpIcon.module.css'), 'utf8')
    const button = readFileSync(join(here, '../SettingsHelpIconButton.tsx'), 'utf8')
    expect(css).toMatch(/\.helpBtn \{[^}]*width: 24px/)
    expect(css).toMatch(/\.helpBtn \{[^}]*height: 24px/)
    expect(css).toMatch(/\.helpBtn \{[^}]*aspect-ratio: 1/)
    expect(css).toMatch(/\.helpBtn \{[^}]*border-radius: 50%/)
    expect(css).toMatch(/\.helpBtn \{[^}]*user-select: none/)
    expect(css).toMatch(/\.helpBtn \{[^}]*outline: none/)
    expect(css).toMatch(/\.helpHost,\s*\.helpBtnHost \{[^}]*user-select: none/)
    expect(button).toContain('styles.helpBtnHost')
    expect(button).toMatch(/className=\{`\$\{styles\.helpBtnHost\} \$\{className\}/)
    expect(button).toContain('className={styles.helpBtn}')
    expect(button).not.toMatch(/className=\{`\$\{styles\.helpBtn\} \$\{className\}/)
  })
})
