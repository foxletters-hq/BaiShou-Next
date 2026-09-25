import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../mobile-raw-data-source.runtime.ts'),
  'utf8'
)

describe('mobile derived index hydration', () => {
  it('should pass GraphSyncService embedder gated by embedMissing false', () => {
    expect(src).toContain('const embedMissing = false')
    expect(src).toContain('embedMissing && embeddingAdapter?.isConfigured')
    expect(src).not.toMatch(/new GraphSyncService\([^)]*\{\s*\}/)
  })
})
