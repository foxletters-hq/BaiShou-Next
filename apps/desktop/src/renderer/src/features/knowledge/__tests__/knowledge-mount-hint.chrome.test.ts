import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('knowledge mount hint chrome', () => {
  it('should show a fixed lime icon when a notebook is mounted', () => {
    const hint = readFileSync(join(here, '..', 'KnowledgeMountHint.tsx'), 'utf8')
    expect(hint).toContain("const MOUNTED_NOTEBOOK_HINT_ICON = '🍋'")
    expect(hint).toContain('{MOUNTED_NOTEBOOK_HINT_ICON}')
    expect(hint).not.toContain('getNotebookCardAppearance')
  })
})
