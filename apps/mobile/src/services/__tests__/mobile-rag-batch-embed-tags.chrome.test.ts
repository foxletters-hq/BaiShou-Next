import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-rag-batch-embed.helpers.ts'),
  'utf8'
)

describe('mobile rag batch embed diary tags', () => {
  it('should read tags from the loaded diary row instead of the detection row', () => {
    expect(src).toContain('resolveDiaryEmbedTagsFromLoadedRow(diary)')
    expect(src).not.toContain('meta.tags')
  })
})
