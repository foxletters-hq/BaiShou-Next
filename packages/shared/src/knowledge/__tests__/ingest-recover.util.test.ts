import { describe, expect, it } from 'vitest'
import { shouldKickKnowledgeIngestAfterRecover } from '../ingest-recover.util'

describe('shouldKickKnowledgeIngestAfterRecover', () => {
  it('should never kick ingest after recover so leftover extract waits for the notebook', () => {
    expect(
      shouldKickKnowledgeIngestAfterRecover({
        resetSources: 0,
        reclaimedEmbedJobs: 0,
        droppedExtractJobs: 0
      })
    ).toBe(false)
    expect(
      shouldKickKnowledgeIngestAfterRecover({
        resetSources: 1,
        reclaimedEmbedJobs: 2,
        droppedExtractJobs: 1
      })
    ).toBe(false)
  })
})
