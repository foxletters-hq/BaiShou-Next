import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'desktop-knowledge-reader.ts'),
  'utf8'
)

describe('desktop knowledge reader chrome', () => {
  it('should hard-block chat search when notebook embeddings mismatch the current model', () => {
    expect(src).toContain('assertKnowledgeModelMatch')
    expect(src).toContain('await assertKnowledgeModelMatch(repo, notebookIds)')
  })

  it('should not swallow embedQuery failures as unconfigured', () => {
    expect(src).not.toMatch(/catch\s*\{\s*return null\s*\}/)
  })
})
