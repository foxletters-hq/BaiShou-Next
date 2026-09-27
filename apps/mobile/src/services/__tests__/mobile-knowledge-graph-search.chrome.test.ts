import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-knowledge.service.ts'),
  'utf8'
)

describe('mobile notebook graph search chrome', () => {
  it('should pass embedQuery into notebook graph search for agent lookups', () => {
    expect(src).toContain('searchNotebookGraphForTool')
    expect(src).toContain('resolveMobileNotebookGraphEmbed')
    expect(src).toMatch(/searchNotebookGraphForTool\([\s\S]*embedQuery/)
    expect(src).toContain('resolveMobileEmbeddingForHydration')
  })
})
