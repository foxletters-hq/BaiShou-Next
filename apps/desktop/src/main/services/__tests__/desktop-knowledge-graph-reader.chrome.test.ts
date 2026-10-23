import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'desktop-knowledge-graph-reader.ts'),
  'utf8'
)

describe('desktop knowledge graph reader chrome', () => {
  it('should vector-search notebook graph nodes with the embedding model', () => {
    expect(src).toContain('searchNotebookGraphForTool')
    expect(src).toContain('getEmbeddingService')
    expect(src).toContain('getEmbeddingConfig')
    expect(src).toContain('embedQuery: resolveEmbed')
    expect(src).toContain('modelId')
    expect(src).toContain('embeddingService.isConfigured')
  })
})
