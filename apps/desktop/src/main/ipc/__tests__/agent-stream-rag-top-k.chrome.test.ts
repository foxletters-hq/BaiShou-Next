import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('agent stream RAG retrieval config', () => {
  it('should inject clamped rag_top_k into userConfig for in-app and MCP vector_search', () => {
    const src = readFileSync(join(here, '../agent-stream-config.ts'), 'utf8')
    expect(src).toContain('clampRagTopK')
    expect(src).toContain('rag_top_k:')
    expect(src).toContain('clampRagSimilarityThreshold')
    expect(src).toContain('rag_similarity_threshold:')
  })
})
