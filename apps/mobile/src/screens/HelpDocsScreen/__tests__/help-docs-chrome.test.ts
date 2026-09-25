import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'HelpDocsScreen.tsx'),
  'utf8'
)

describe('mobile help docs chrome', () => {
  it('should show a header label that opens the tutorial in the browser', () => {
    expect(src).toContain('headerRight={{')
    expect(src).toContain("t('settings.help_docs_open_browser', '在浏览器中打开')")
    expect(src).toContain('Linking.openURL(HELP_DOCS_QUICK_START_URL)')
    expect(src).toContain("from '@baishou/ui/native'")
    expect(src).not.toContain('#fff')
    expect(src).not.toContain('#000')
  })
})
