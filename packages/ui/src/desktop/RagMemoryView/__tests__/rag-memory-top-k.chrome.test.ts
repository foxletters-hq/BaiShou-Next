import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('RAG retrieval Top-K chrome', () => {
  it('should bind the retrieval slider to RAG_TOP_K_MAX', () => {
    const desktop = read('../RagMemoryConfigBlock.tsx')
    expect(desktop).toContain('RAG_TOP_K_MAX')
    expect(desktop).toContain('max={String(RAG_TOP_K_MAX)}')
  })
})
