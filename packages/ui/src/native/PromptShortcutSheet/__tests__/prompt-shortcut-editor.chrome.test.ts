import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const editor = readFileSync(join(here, '../PromptShortcutEditor.tsx'), 'utf8')
const styles = readFileSync(join(here, '../prompt-shortcut-sheet.styles.ts'), 'utf8')
const sheet = readFileSync(join(here, '../PromptShortcutSheet.tsx'), 'utf8')

describe('PromptShortcutEditor chrome', () => {
  it('should edit slash command and description as separate fields', () => {
    expect(editor).toContain("t('shortcut.command_label'")
    expect(editor).toContain("t('shortcut.description_label'")
    expect(editor).toContain('draftCommand')
    expect(editor).toContain('draftDescription')
    expect(sheet).toContain('resolveShortcutEditorDraft')
    expect(sheet).not.toContain('setDraftName(item.name')
  })

  it('should stretch editor fields to the same inset and keep the body short enough to show save', () => {
    expect(editor).not.toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(styles).toMatch(/editorScrollContent:[\s\S]*paddingRight: 0/)
    expect(styles).toMatch(/fieldBlock:[\s\S]*width: '100%'/)
    expect(styles).toMatch(
      /fieldTextArea:[\s\S]*minHeight: sharedTokens\.spacing\.xxxl \* 3 \+ sharedTokens\.spacing\.xl/
    )
    expect(styles).toMatch(/editorRoot:[\s\S]*flex: 1/)
    expect(editor).toMatch(
      /<View style=\{styles\.editorRoot\}>[\s\S]*<ScrollView[\s\S]*<\/ScrollView>[\s\S]*styles\.formActions/
    )
  })
})
