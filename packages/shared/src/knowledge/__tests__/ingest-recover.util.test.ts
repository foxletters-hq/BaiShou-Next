import { describe, expect, it } from 'vitest'
import { shouldKickKnowledgeIngestAfterRecover } from '../ingest-recover.util'

describe('shouldKickKnowledgeIngestAfterRecover', () => {
  it('should not kick ingest when recover found no stale work', () => {
    expect(
      shouldKickKnowledgeIngestAfterRecover({
        resetSources: 0,
        reclaimedEmbedJobs: 0,
        droppedExtractJobs: 0
      })
    ).toBe(false)
  })

  it('should kick ingest only when recover requeued or reclaimed work', () => {
    expect(
      shouldKickKnowledgeIngestAfterRecover({
        resetSources: 1,
        reclaimedEmbedJobs: 0,
        droppedExtractJobs: 0
      })
    ).toBe(true)
    expect(
      shouldKickKnowledgeIngestAfterRecover({
        resetSources: 0,
        reclaimedEmbedJobs: 2,
        droppedExtractJobs: 0
      })
    ).toBe(true)
  })
})
