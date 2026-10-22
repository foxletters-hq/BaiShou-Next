import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '../InlinePromptShortcutList.tsx'), 'utf8')
const indexSrc = readFileSync(join(here, '../index.tsx'), 'utf8')
const hookSrc = readFileSync(join(here, '../useNativeInputBar.tsx'), 'utf8')

describe('InlinePromptShortcutList skill chrome', () => {
  it('should show a lucide icon plus name and description instead of an emoji', () => {
    expect(src).toContain('LucideIcon')
    expect(src).toContain('Sparkles')
    expect(src).toContain('FolderOpen')
    expect(src).toContain('shortcut.description || shortcut.name')
    expect(src).not.toContain("shortcut.icon || '⚡'")
    expect(src).toContain("t('shortcut.skill_picker_title', 'Skill')")
  })

  it('should enable list scrolling and stay anchored above composer without negative bounds offset', () => {
    expect(src).toContain('scrollEnabled={true}')
    expect(src).not.toContain("bottom: '100%'")
    expect(src).toContain("position: 'absolute'")
    expect(src).toContain('top: 0')
    expect(src).toContain('INLINE_SHORTCUT_HEIGHT_RESET_MS')
    expect(indexSrc).not.toContain('composerChromeAnchor')
    expect(indexSrc).toContain('paddingTop: bar.shortcutPanelHeight')
  })

  it('should reserve the panel height in the same render as it opens to avoid first-frame flicker', () => {
    expect(src).toContain('resolveInlinePromptShortcutPanelHeight')
    expect(hookSrc).toContain('resolveInlinePromptShortcutPanelHeight(')
    expect(hookSrc).toContain('shortcutHandlers.filteredShortcuts.length')
    expect(hookSrc).not.toContain(
      'const [shortcutPanelHeight, setShortcutPanelHeight] = useState(0)'
    )
  })
})
