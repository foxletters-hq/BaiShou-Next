import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('knowledge citation dialog chrome', () => {
  it('should wrap the reply with a citation dialog host instead of stacking excerpts', () => {
    const block = readFileSync(join(here, '../KnowledgeCitationBlock.tsx'), 'utf8')
    expect(block).toContain('<Modal')
    expect(block).toContain('openFromHref')
    expect(block).not.toContain('<details')
  })
})
