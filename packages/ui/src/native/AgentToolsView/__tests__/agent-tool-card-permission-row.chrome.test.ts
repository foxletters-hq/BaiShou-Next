import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '../AgentToolCard.tsx'), 'utf8')

describe('native AgentToolCard companion permission row', () => {
  it('should hide English tool ids from the permission row', () => {
    expect(src).not.toContain('toolIdTag')
    expect(src).not.toContain('toolIdText')
    expect(src).not.toMatch(/<Text[^>]*>\s*\{\s*tool\.id\s*\}/)
  })

  it('should place SegmentedControl on the same row as the tool name', () => {
    expect(src).toContain("from '../SegmentedControl'")
    expect(src).toContain('effectSlot')
    expect(src).not.toContain('effectRow')
    expect(src).not.toContain('effectChip')
    expect(src).toContain('stretch={false}')
    expect(src).toContain('size="small"')
  })
})
