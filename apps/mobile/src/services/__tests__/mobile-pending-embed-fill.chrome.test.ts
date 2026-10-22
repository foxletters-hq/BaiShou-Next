import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-pending-embed-fill.ts'),
  'utf8'
)

describe('mobile pending embed fill graph extract', () => {
  it('should treat queued graph extract as discovered work and skip empty refresh notify', () => {
    expect(src).toContain('queued.totalPending')
    expect(src).toContain('notifyMobilePendingEmbedCountsChanged')
    expect(src.lastIndexOf("skippedReason: 'nothing-to-embed'")).toBeLessThan(
      src.lastIndexOf('notifyMobilePendingEmbedCountsChanged')
    )
    expect(src).not.toContain('const extractDone = 0')
  })

  it('should report active item date/title and extraction phase in status text', () => {
    expect(src).toContain('describeGraphExtractPhase')
    expect(src).toContain('resolveGraphExtractItemDateOrTitle')
    expect(src).toContain('graph.extract_item_detail')
    expect(src).toContain("it.status === 'running' || it.status === 'aligning'")
  })

  it('should configure mobile extract pool size to 4 to reduce batch wait latency', () => {
    const queueSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-graph-extract-queue.service.ts'),
      'utf8'
    )
    expect(queueSrc).toContain('MOBILE_GRAPH_EXTRACT_ALIGN_POOL_SIZE = 4')
    expect(queueSrc).toContain('alignPoolSize: MOBILE_GRAPH_EXTRACT_ALIGN_POOL_SIZE')
  })

  it('should not auto-resume unfinished graph extract after an app restart', () => {
    const queueSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-graph-extract-queue.service.ts'),
      'utf8'
    )
    expect(queueSrc).toContain('discardPersistedQueue')
    expect(queueSrc).not.toContain('restoreFromStorage')
    expect(queueSrc).not.toContain('await this.enqueue({ filePaths: items')
  })

  it('should skip inline GraphSyncService embedder during extract commit and report graph_node progress', () => {
    const extractSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-graph-extract.ts'),
      'utf8'
    )
    expect(extractSrc).toContain('new GraphSyncService(graphManager, repo, null)')
    expect(src).toContain('settings.rag_indexing_graph_node_progress')
  })
})
