import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('knowledge mount hint chrome', () => {
  it('should show a mounted-notebook chip with count and manage chevron', () => {
    const hint = readFileSync(join(here, '..', 'KnowledgeMountHint.tsx'), 'utf8')
    expect(hint).toContain('BookOpen')
    expect(hint).toContain('ChevronRight')
    expect(hint).toContain('agent.mounted_notebooks_count')
    expect(hint).toContain('agent.mounted_notebooks')
    expect(hint).toContain('refreshToken')
    expect(hint).not.toContain('getNotebookCardAppearance')
  })
})
