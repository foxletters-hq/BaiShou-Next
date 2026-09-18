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
  })

  it('should run the suspect scan after graph extract in pending fill', () => {
    expect(fillSrc).toContain('runMobileGraphSuspectScan')
    expect(fillSrc.indexOf('mobile graph extract phase failed')).toBeLessThan(
      fillSrc.indexOf('runMobileGraphSuspectScan')
    )
  })

  it('should fill memory then knowledge then extract then graph nodes', () => {
    expect(fillSrc.indexOf("markPhaseDone(phases, 'memory')")).toBeLessThan(
      fillSrc.indexOf('await consumeMobileKnowledgeIngestJobs')
    )
    expect(fillSrc.indexOf("markPhaseDone(phases, 'knowledge')")).toBeLessThan(
      fillSrc.indexOf('await consumeMobileKnowledgeGraphJobs')
    )
    expect(fillSrc.indexOf("markPhaseDone(phases, 'graph_extract')")).toBeLessThan(
      fillSrc.indexOf('await backfillUnembeddedGraphNodes')
    )
    expect(fillSrc.indexOf('await backfillUnembeddedGraphNodes')).toBeLessThan(
      fillSrc.indexOf('runMobileGraphSuspectScan({ vaultId })')
    )
    expect(fillSrc).toContain('const report = (phase: RagBatchEmbedPhaseKind')
  })
})
