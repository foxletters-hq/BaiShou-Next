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
    const native = readFileSync(
      join(here, '../../../native/Tooltip/HelpTooltip.tsx'),
      'utf8'
    )
    expect(tooltip).toContain('size={HELP_ICON_SIZE}')
    expect(button).toContain('size={HELP_ICON_SIZE}')
    expect(native).toContain('size={HELP_ICON_SIZE}')
  })
})
