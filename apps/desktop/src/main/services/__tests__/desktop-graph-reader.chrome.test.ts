import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'desktop-graph-reader.ts'),
  'utf8'
)

describe('desktop graph reader chrome', () => {
  it('should pass edge id, source, validFrom and isCurrent to recall_relations', () => {
    expect(src).toContain('id: e.id')
    expect(src).toContain('sourceRef: e.sourceRef')
    expect(src).toContain('validFrom: e.validFrom')
    expect(src).toContain('isCurrent: e.isCurrent')
  })
})
