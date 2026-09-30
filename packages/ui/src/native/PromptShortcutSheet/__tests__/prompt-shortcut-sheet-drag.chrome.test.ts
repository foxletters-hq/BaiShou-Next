import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const sheet = readFileSync(join(here, '../PromptShortcutSheet.tsx'), 'utf8')
const row = readFileSync(join(here, '../PromptShortcutRow.tsx'), 'utf8')

describe('PromptShortcutSheet drag chrome', () => {
  it('should reorder skills with a draggable list instead of up/down buttons', () => {
    expect(sheet).toContain('DraggableFlatList')
    expect(sheet).toContain('mergePageReorder')
    expect(sheet).not.toContain('handleMoveItem')
    expect(row).toContain('GripVertical')
    expect(row).not.toContain('ChevronUp')
  })
})
