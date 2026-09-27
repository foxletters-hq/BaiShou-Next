import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('knowledge vector search chrome', () => {
  it('should keep the inner search field square so selection is not clipped to a capsule', () => {
    const pane = readFileSync(join(here, '..', 'KnowledgeVectorPane.tsx'), 'utf8')
    const css = readFileSync(join(here, '..', 'KnowledgePage.module.css'), 'utf8')
    expect(pane).toContain('baishou-form-field--embed')
    expect(css).toMatch(/\.vectorSearchBox \{[\s\S]*align-items: center/)
    expect(css).toMatch(/\.vectorSearchBox \.vectorSearchInput[\s\S]*border-radius:\s*0/)
    expect(css).not.toMatch(/\.vectorSearchBox \.vectorSearchInput[\s\S]*align-self:\s*stretch/)
    expect(css).toMatch(/\.vectorSearchBox \.vectorSearchInput[\s\S]*align-self:\s*center/)
    expect(css).toMatch(/\.vectorSearchBox \.vectorSearchInput[\s\S]*line-height:\s*26px/)
    expect(css).toMatch(/\.vectorSearchBox \.vectorSearchInput[\s\S]*height:\s*26px/)
    expect(css).toContain('font-size: var(--ui-fs-md)')
  })
})
