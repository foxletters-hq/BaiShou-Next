import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveShortcutDisplayInfo } from '../prompt-shortcut-display.util'

const here = dirname(fileURLToPath(import.meta.url))
const row = readFileSync(join(here, '../PromptShortcutRow.tsx'), 'utf8')
const styles = readFileSync(join(here, '../prompt-shortcut-sheet.styles.ts'), 'utf8')

describe('PromptShortcutRow style rules and dropdown menu', () => {
  it('should use semantic surface and avoid shadows per user request and UI theme rules', () => {
    expect(row).toContain('backgroundColor: cardBg')
    expect(row).toContain('colors.bgSurface')
    expect(styles).not.toContain('shadowColor:')
    expect(styles).not.toContain('elevation:')
    expect(styles).toContain('borderWidth: 1')
  })

  it('should tuck edit and delete into a ContextMenu that closes on outside press', () => {
    expect(row).toContain('MoreVertical')
    expect(row).toContain('ContextMenu')
    expect(row).toContain('setMenuOpen')
    expect(row).toContain('computeAnchoredMenuPosition')
    expect(row).toContain('measureInWindow')
    expect(row).not.toContain('dropdownMenu')
    expect(row).not.toContain('menuBackdrop')
  })

  it('should use list and hint typography instead of caption for tips', () => {
    const sheet = readFileSync(join(here, '../PromptShortcutSheet.tsx'), 'utf8')
    const editor = readFileSync(join(here, '../PromptShortcutEditor.tsx'), 'utf8')
    expect(styles).toContain('slashHint')
    expect(styles).toMatch(/slashHint:[\s\S]*mobileTypography\.secondary\.fontSize/)
    expect(styles).toMatch(/dragHint:[\s\S]*mobileTypography\.secondary\.fontSize/)
    expect(styles).toMatch(/itemCommand:[\s\S]*mobileTypography\.secondary\.fontSize/)
    expect(styles).toMatch(/itemName:[\s\S]*mobileTypography\.secondary\.fontSize/)
    expect(styles).toMatch(/itemContent:[\s\S]*mobileTypography\.secondary\.fontSize/)
    expect(styles).toMatch(/emptyText:[\s\S]*mobileTypography\.secondary\.fontSize/)
    expect(styles).toMatch(/headerText:[\s\S]*mobileTypography\.title\.fontSize/)
    expect(styles).toMatch(/searchInput:[\s\S]*mobileTypography\.body\.fontSize/)
    expect(row).not.toContain("from '../Button'")
    expect(row).not.toContain("t('common.use'")
    expect(sheet).toContain("from '../Button'")
    expect(editor).toContain("from '../Button'")
    expect(row).not.toContain('mobileTypography.caption.fontSize')
  })

  it('should protect create-skill by hiding dropdown and showing builtin badge', () => {
    expect(row).toContain('isProtected')
    expect(row).toContain('props.canManage && !isProtected')
    expect(row).toContain('systemBadge')
    expect(row).toContain("t('shortcut.builtin_tag', '内置')")
    expect(row).not.toContain('引导')
  })

  it('should use the row tap to apply a skill and keep only the more menu on the right', () => {
    expect(row).toContain('onPress={handlePress}')
    expect(row).toContain('onLongPress={canStartDrag ? startDrag : undefined}')
    expect(row).toContain('MoreVertical')
    expect(row).not.toContain('size="sm"')
  })

  it('should allow dragging builtin skills instead of pinning them', () => {
    expect(row).toContain(
      'const canStartDrag = props.canManage && props.canDrag && Boolean(props.onDrag)'
    )
    expect(row).not.toContain('!isProtected && props.canDrag')
  })

  it('should deduplicate description and content when display texts overlap', () => {
    const dummyLabels = {
      translateName: '翻译',
      translateContent: '请翻译',
      summarizeName: '总结',
      summarizeContent: '请总结'
    }

    const info = resolveShortcutDisplayInfo(
      {
        id: 'daily-writer',
        command: 'daily-writer',
        name: '日常写作助理',
        description: '日常写作助理',
        content: '日常写作助理：根据输入撰写今日短篇日记。'
      },
      dummyLabels
    )

    expect(info.command).toBe('daily-writer')
    expect(info.showCustomName).toBe(true)
    expect(info.customName).toBe('日常写作助理')
    expect(info.displayDesc).toBe('根据输入撰写今日短篇日记。')

    const mdInfo = resolveShortcutDisplayInfo(
      {
        id: 'daily-writer',
        command: 'daily-writer',
        name: 'daily-writer',
        description: '日常写作助理',
        content: '# 日常写作助理\n根据输入撰写今日短篇日记。'
      },
      dummyLabels
    )
    expect(mdInfo.command).toBe('daily-writer')
    expect(mdInfo.customName).toBe('日常写作助理')
    expect(mdInfo.displayDesc).toBe('根据输入撰写今日短篇日记。')
  })
})
