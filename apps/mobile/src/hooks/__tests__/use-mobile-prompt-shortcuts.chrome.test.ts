import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../useMobilePromptShortcuts.ts'),
  'utf8'
)

describe('useMobilePromptShortcuts chrome', () => {
  it('should reload the list when a skill file is written', () => {
    expect(src).toContain('subscribeMobileSkillsChanged')
    expect(src).toContain('void loadShortcuts()')
  })

  it('should persist mixed display order so builtin skills can sit below custom ones', () => {
    expect(src).toContain('applyShortcutDisplayOrder')
    expect(src).toContain('prompt_shortcut_order_v1')
    expect(src).toContain('next.map((item) => item.id)')
  })
})
