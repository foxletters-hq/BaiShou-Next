import { describe, expect, it } from 'vitest'
import { INCREMENTAL_SYNC_CHECKPOINT_COMMIT_STEPS } from '../incremental-sync-checkpoint-commit.util'

describe('INCREMENTAL_SYNC_CHECKPOINT_COMMIT_STEPS', () => {
  it('keeps local → remote → ancestor order', () => {
    expect([...INCREMENTAL_SYNC_CHECKPOINT_COMMIT_STEPS]).toEqual([
      'local',
      'remote',
      'ancestor'
    ])
  })
})
