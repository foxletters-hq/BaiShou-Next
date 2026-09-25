import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const querySrc = readFileSync(join(dir, '../mobile-graph-query.ts'), 'utf8')
const reviewSrc = readFileSync(join(dir, '../mobile-graph-review.ts'), 'utf8')
const fillSrc = readFileSync(join(dir, '../mobile-pending-embed-fill.ts'), 'utf8')

describe('mobile graph suspect', () => {
  it('should expose listSuspectNodes and persist suspectReason as pending', () => {
    expect(querySrc).toContain('export async function mobileListSuspectNodes')
    expect(querySrc).toContain('listSuspectNodes')
    expect(reviewSrc).toContain('writeMobileNodeSuspectReason')
    expect(reviewSrc).toContain("reviewStatus: 'pending'")
    expect(reviewSrc).toContain('applySuspectReasonToProps')
    expect(reviewSrc).toContain('removeSuspectReasonFromProps')
  })

  it('should run the suspect scan after graph extract in pending fill', () => {
    expect(fillSrc).toContain('runMobileGraphSuspectScan')
    expect(fillSrc.indexOf('mobile graph extract phase failed')).toBeLessThan(
      fillSrc.indexOf('runMobileGraphSuspectScan')
    )
  })

  it('should fill memory then diary extract then diary graph nodes', () => {
    expect(fillSrc).not.toContain('consumeMobileKnowledgeIngestJobs')
    expect(fillSrc).not.toContain('consumeMobileKnowledgeGraphJobs')
    expect(fillSrc).not.toContain('NotebookGraphRepository')
    expect(fillSrc.indexOf("phases = markPhaseDone(phases, 'memory')")).toBeLessThan(
      fillSrc.indexOf('await mobileGraphExtractQueue.enqueue')
    )
    expect(fillSrc.indexOf("phases = markPhaseDone(phases, 'graph_extract')")).toBeLessThan(
      fillSrc.indexOf('await backfillUnembeddedGraphNodes')
    )
    expect(fillSrc.indexOf('await backfillUnembeddedGraphNodes')).toBeLessThan(
      fillSrc.indexOf('runMobileGraphSuspectScan({ vaultId })')
    )
    expect(fillSrc).toContain('const report = (phase: RagBatchEmbedPhaseKind')
  })

  it('should send the graph provider into generateContent instead of the summary slot', () => {
    const extract = readFileSync(join(dir, '../mobile-knowledge-graph-extract.ts'), 'utf8')
    expect(extract).toContain('const { providerId, modelId } = resolveGlobalGraphModelIds')
    expect(extract).toContain('abortSignal: AbortSignal.timeout(GRAPH_EXTRACT_WINDOW_TIMEOUT_MS)')
    expect(extract).toContain('graph-extract-window-timeout')
    expect(extract).toMatch(/generateContent\([\s\S]*?providerId/)
    const suspect = readFileSync(join(dir, '../mobile-graph-suspect-scan.ts'), 'utf8')
    expect(suspect).toContain('const { providerId, modelId } = resolveGlobalGraphModelIds')
    expect(suspect).toMatch(/generateContent\([\s\S]*?providerId/)
  })
})
