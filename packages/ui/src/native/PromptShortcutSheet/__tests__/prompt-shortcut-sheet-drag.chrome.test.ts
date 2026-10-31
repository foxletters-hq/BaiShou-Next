import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const sheet = readFileSync(join(here, '../PromptShortcutSheet.tsx'), 'utf8')
const row = readFileSync(join(here, '../PromptShortcutRow.tsx'), 'utf8')
const styles = readFileSync(join(here, '../prompt-shortcut-sheet.styles.ts'), 'utf8')

describe('PromptShortcutSheet drag chrome', () => {
  it('should reorder skills with a draggable list instead of up/down buttons', () => {
    expect(sheet).toContain('DraggableFlatList')
    expect(sheet).toContain('mergePageReorder')
    expect(sheet).not.toContain('handleMoveItem')
    expect(row).not.toContain('GripVertical')
    expect(row).toContain("from 'react-native-gesture-handler'")
    expect(row).toContain('onLongPress={canStartDrag ? startDrag : undefined}')
    expect(row).toContain('activeOpacity={1}')
    expect(row).not.toContain('disabled={Boolean(props.isDragging)}')
    expect(row).toContain('delayLongPress=')
    expect(row).not.toContain('ChevronUp')
  })

  it('should start drag without extra pan travel and clamp spring overshoot', () => {
    expect(sheet).toContain('activationDistance={0}')
    expect(sheet).toContain('autoscrollThreshold={tokens.spacing.sm}')
    expect(sheet).toContain('overshootClamping: true')
    expect(sheet).toContain('onDragBegin={handleDragBegin}')
    expect(sheet).toContain('nativeLightHaptic')
  })

  it('should keep drag order locally so persist does not flash the list', () => {
    expect(sheet).toContain('isSameShortcutOrder')
    expect(sheet).toContain(
      'setListData((prev) => (isSameShortcutOrder(prev, data) ? prev : data))'
    )
    expect(sheet).toContain('shortcutsRef.current')
    expect(sheet).toMatch(/useMemo\(\(\) => getDefaultShortcutLabelsFromT\(t\)/)
    expect(sheet).toContain('listSizeStyle')
    expect(sheet).toContain('dragResetKey')
    expect(sheet).toContain('isDraggingRef.current')
    expect(sheet).toContain('{filteredShortcuts.length > 0 ? (')
  })

  it('should keep the more menu inside the row instead of overflowing', () => {
    expect(styles).not.toMatch(/item:[\s\S]*overflow: 'hidden'/)
    expect(styles).toMatch(/itemBody:[\s\S]*minWidth: 0/)
    expect(styles).toMatch(/itemActions:[\s\S]*flexShrink: 0/)
    expect(styles).toMatch(/itemActions:[\s\S]*width: 30/)
    expect(sheet).toContain('showsVerticalScrollIndicator={false}')
    expect(row).toContain('styles.itemBodyPress')
  })

  it('should stretch skill cards to the same width as the search field', () => {
    expect(styles).not.toMatch(/listContent:[\s\S]*paddingRight: sharedTokens\.spacing\.mdTight/)
  })
})
