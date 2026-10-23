import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = [
  join(dirname(fileURLToPath(import.meta.url)), '..', 'MobileNotebookMountSheet.tsx'),
  join(dirname(fileURLToPath(import.meta.url)), '..', 'KnowledgeMountHintBar.tsx'),
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentChatList.tsx')
]
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

describe('mobile notebook mount sheet chrome', () => {
  it('should use the official modal and checkbox with theme tokens', () => {
    expect(src).toContain("from '@baishou/ui/native'")
    expect(src).toContain('Modal')
    expect(src).toContain('Checkbox')
    expect(src).toContain('useNativeTheme')
    expect(src).not.toContain("Modal } from 'react-native'")
    expect(src).not.toContain('#fff')
    expect(src).not.toContain('#666')
    expect(src).toContain('setPendingMountedNotebookIds')
    expect(src).not.toContain('notebook_mount_need_session')
    expect(src).toContain('coverImageUrl')
    expect(src).toContain('knowledge.notebook_mount_clear')
    expect(src).toContain('KnowledgeMountHintBar')
    expect(src).toContain('agent.mounted_notebooks')
  })

  it('should inset the notebook mount list scroll indicator like skill cite preview', () => {
    expect(src).toContain('paddingRight: tokens.spacing.mdTight')
    expect(src).toContain('keyboardShouldPersistTaps="handled"')
  })

  it('should use compact size="sm" buttons in modalActionsStyle', () => {
    expect(src).toContain('modalActionsStyle')
    expect(src).toContain('size="sm"')
  })

  it('should render mounted count in a pill chip tag above the input bar', () => {
    expect(src).toContain('BookOpen')
    expect(src).toContain('sharedTokens.radius.full')
    expect(src).toContain('mounted_notebooks')
  })

  it('should allow tapping the whole row to select and vertically center the checkbox', () => {
    const sheetSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'MobileNotebookMountSheet.tsx'),
      'utf8'
    )
    expect(sheetSrc).toContain('accessibilityRole="checkbox"')
    expect(sheetSrc).toContain("alignItems: 'center'")
    expect(sheetSrc).not.toContain("alignItems: 'flex-start'")
  })
})
