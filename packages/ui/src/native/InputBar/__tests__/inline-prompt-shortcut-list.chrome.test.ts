import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../InlinePromptShortcutList.tsx'),
  'utf8'
)

describe('InlinePromptShortcutList skill chrome', () => {
  it('should show a lucide icon plus name and description instead of an emoji', () => {
    expect(src).toContain('LucideIcon')
    expect(src).toContain('Sparkles')
    expect(src).toContain('FolderOpen')
    expect(src).toContain('shortcut.description || shortcut.name')
    expect(src).not.toContain("shortcut.icon || '⚡'")
    expect(src).toContain("t('shortcut.skill_picker_title', 'Skill')")
  })
})
