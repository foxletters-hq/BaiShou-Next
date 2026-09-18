import { describe, expect, it } from 'vitest'
import { RAG_MIGRATION_STATUS } from '@baishou/shared'
import { isRagMigrationStreamTerminal, newMemoryId } from '../rag-build.util'

describe('rag-build.util', () => {
  it('should mark aborted or listed status keys as terminal', () => {
    expect(isRagMigrationStreamTerminal(undefined, true)).toBe(true)
    expect(isRagMigrationStreamTerminal(RAG_MIGRATION_STATUS.complete, false)).toBe(true)
    expect(isRagMigrationStreamTerminal(RAG_MIGRATION_STATUS.cancelled, false)).toBe(true)
  })

  it('should keep in-progress statuses non-terminal when not aborted', () => {
    expect(isRagMigrationStreamTerminal(RAG_MIGRATION_STATUS.inProgress, false)).toBe(false)
    expect(isRagMigrationStreamTerminal(undefined, false)).toBe(false)
  })

  it('should create a non-empty memory id', () => {
    expect(newMemoryId().length).toBeGreaterThan(0)
  })
})
