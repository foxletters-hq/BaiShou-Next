import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const pane = readFileSync(join(dir, '..', 'components', 'HelpDocsPane.tsx'), 'utf8')
const paneCss = readFileSync(join(dir, '..', 'components', 'HelpDocsPane.module.css'), 'utf8')
const chromeCss = readFileSync(
  join(dir, '../../../../../../../../packages/ui/src/desktop/shared/SettingsPageChrome.module.css'),
  'utf8'
)

describe('desktop help docs chrome', () => {
  it('should show an official trailing button that opens the tutorial in the browser', () => {
    expect(pane).toContain("from '@baishou/ui'")
    expect(pane).toContain('<Button')
    expect(pane).toContain('trailing={')
    expect(pane).toContain("t('settings.help_docs_open_browser', '在浏览器中打开')")
    expect(pane).toContain('window.api.shell.openExternal')
    expect(pane).not.toContain('className={styles.openExternalIcon}')
    expect(pane).not.toContain('aria-label={t(\'settings.help_docs_open_browser\'')
    expect(paneCss).not.toContain('.openExternalIcon')
    expect(paneCss).not.toContain('#fff')
    expect(paneCss).not.toContain('#000')
  })

  it('should let the settings trailing slot size to a text button', () => {
    expect(chromeCss).toContain('.trailing :is(button, a) {')
    expect(chromeCss).toContain('width: auto;')
    expect(chromeCss).toMatch(/\.titleAccessory :is\(button, a\) \{\s*width: 28px;/)
  })
})
