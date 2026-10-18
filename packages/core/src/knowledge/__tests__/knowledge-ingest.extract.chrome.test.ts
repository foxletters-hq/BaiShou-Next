import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'knowledge-ingest.extract.ts'),
  'utf8'
)

describe('knowledge ingest extract chrome', () => {
  it('should send pdfVisionOnly PDFs to vision and skip the text layer', () => {
    expect(src).toContain('resolvePdfExtractEngine')
    expect(src).toContain('pdfVisionOnly')
    expect(src).toContain('cfg.pdfVisionOnly && resolved.degraded')
    expect(src).toContain('!cfg.pdfVisionOnly &&')
  })
})
