import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-pending-embed-counts.ts'),
  'utf8'
)

describe('mobile pending embed counts notebook nodes', () => {
  it('should count notebook graph nodes separately from knowledge sources', () => {
    expect(src).toContain('listUnembeddedLiveNodes')
    expect(src).toContain('missingNotebookGraphNodeCount')
    expect(src).toContain('countPendingNotebookGraphNodes')
    expect(src).toContain('countPendingKnowledgeSources')
  })
})
