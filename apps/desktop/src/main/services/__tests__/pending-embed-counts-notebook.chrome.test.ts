import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'pending-embed-counts.service.ts'),
  'utf8'
)

describe('desktop pending embed counts stay on the memory system', () => {
  it('should not count notebook vectors or notebook graph nodes for memory pending embeds', () => {
    expect(src).not.toContain('missingNotebookGraphNodeCount')
    expect(src).not.toContain('countPendingNotebookGraphNodes')
    expect(src).not.toContain('countPendingKnowledgeSources')
    expect(src).not.toContain("stages: ['graph']")
    expect(src).toContain('countUnindexedDiariesForActiveVault')
    expect(src).toContain('countPendingMemories')
    expect(src).toContain('countPendingGraphNodes')
  })

  it('should broadcast embed-pending-changed when notifying count changes', () => {
    expect(src).toContain('export function notifyPendingEmbedCountsChanged')
    expect(src).toContain("type: 'embed-pending-changed'")
  })
})
