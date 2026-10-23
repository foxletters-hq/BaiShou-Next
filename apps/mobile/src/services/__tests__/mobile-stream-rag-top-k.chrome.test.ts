import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('mobile stream RAG retrieval config', () => {
  it('should inject clamped rag_top_k into userConfig for in-app and MCP vector_search', () => {
    const src = readFileSync(join(here, '../mobile-context-at-message.service.ts'), 'utf8')
    expect(src).toContain('clampRagTopK')
    expect(src).toContain('rag_top_k:')
  })
})
