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

describe('desktop pending embed fill order', () => {
  it('should fill knowledge after memory when running desktop pending fill', () => {
    expect(indexOfCall("markPhaseDone(phases, 'memory')")).toBeLessThan(
      indexOfCall('await consumeKnowledgeIngestJobs')
    )
  })

  it('should extract graph after knowledge when running desktop pending fill', () => {
    expect(indexOfCall("markPhaseDone(phases, 'knowledge')")).toBeLessThan(
      indexOfCall('await consumeKnowledgeGraphJobs')
    )
  })

  it('should backfill graph node embeddings after extract when running desktop pending fill', () => {
    expect(indexOfCall("markPhaseDone(phases, 'graph_extract')")).toBeLessThan(
      indexOfCall('await backfillUnembeddedGraphNodes')
    )
  })

  it('should scan suspects after graph node fill when running desktop pending fill', () => {
    expect(indexOfCall('[PendingEmbedFill] graph node fill failed')).toBeLessThan(
      indexOfCall('runDesktopGraphSuspectScan')
    )
  })
})
