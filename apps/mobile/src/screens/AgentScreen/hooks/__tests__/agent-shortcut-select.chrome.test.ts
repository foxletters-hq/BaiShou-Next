import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../useAgentScreenInteractions.ts'),
  'utf8'
)

describe('mobile agent shortcut select chrome', () => {
  it('should apply selected skills through the input bar cite path', () => {
    expect(src).toContain('applyShortcut(shortcut)')
    expect(src).not.toContain('insertShortcutContent(shortcut.content')
  })
})
