import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'pending-embed-fill.service.ts'),
  'utf8'
)

function indexOfCall(marker: string): number {
  const index = src.indexOf(marker)
  if (index < 0) {
    throw new Error(`未找到标记：${marker}`)
  }
  return index
}

describe('desktop pending embed fill stays on the memory system', () => {
  it('should not consume notebook ingest or notebook graph jobs', () => {
    expect(src).not.toContain('consumeKnowledgeIngestJobs')
    expect(src).not.toContain('consumeKnowledgeGraphJobs')
    expect(src).not.toContain('NotebookGraphRepository')
  })

  it('should backfill diary graph node embeddings after extract', () => {
    expect(indexOfCall("markPhaseDone(phases, 'graph_extract')")).toBeLessThan(
      indexOfCall('await backfillUnembeddedGraphNodes')
    )
  })

  it('should scan suspects after graph node fill when running desktop pending fill', () => {
    expect(indexOfCall('[PendingEmbedFill] graph node fill failed')).toBeLessThan(
      indexOfCall('runDesktopGraphSuspectScan')
    )
    expect(indexOfCall('runDesktopGraphSuspectScan')).toBeLessThan(
      indexOfCall('notifyPendingEmbedCountsChanged()')
    )
  })
})
