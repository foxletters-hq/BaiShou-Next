import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SETTINGS_HELP_DOCS_ITEM,
  SETTINGS_HUB_GROUPS,
  getHubItemIconId,
  getHubItemTitleKey
} from '../settingsHubItems'

const here = dirname(fileURLToPath(import.meta.url))
const screenSrc = readFileSync(join(here, '../SettingsScreen.tsx'), 'utf8')
const accountPanelSrc = readFileSync(join(here, '../components/SettingsAccountPanel.tsx'), 'utf8')

describe('settings help-docs placement aligned with desktop general group', () => {
  it('should expose help-docs with BookOpen icon id outside the data group', () => {
    expect(SETTINGS_HELP_DOCS_ITEM.id).toBe('help-docs')
    expect(SETTINGS_HELP_DOCS_ITEM.icon).toBe('help-docs')
    expect(SETTINGS_HELP_DOCS_ITEM.route).toEqual({
      type: 'stack',
      pathname: '/settings/help-docs'
    })
    const allGroupItemIds = SETTINGS_HUB_GROUPS.flatMap((g) => g.items.map((item) => item.id))
    expect(allGroupItemIds).not.toContain('help-docs')
    expect(getHubItemTitleKey('help-docs')).toBe('settings.help_docs')
    expect(getHubItemIconId('help-docs')).toBe('help-docs')
  })

  it('should embed SETTINGS_HELP_DOCS_ITEM at the bottom of QuickSettingsGroup below chat background', () => {
    expect(screenSrc).toContain('footer={renderNavItem(SETTINGS_HELP_DOCS_ITEM, true)}')
    expect(accountPanelSrc).toContain('isLast={!footer}')
    expect(accountPanelSrc).toContain('<SettingsGroupDivider />')
    expect(accountPanelSrc).toContain('{footer}')
  })
})
