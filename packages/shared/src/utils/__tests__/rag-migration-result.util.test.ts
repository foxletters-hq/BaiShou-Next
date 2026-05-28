import { describe, expect, it } from 'vitest'
import { RAG_MIGRATION_STATUS } from '../../constants/rag-migration.constants'
import { buildMigrationStreamResult } from '../rag-migration-result.util'

describe('buildMigrationStreamResult', () => {
  it('treats api key missing as failed, not interrupted', () => {
    const result = buildMigrationStreamResult(false, RAG_MIGRATION_STATUS.apiKeyMissing)
    expect(result.outcome).toBe('failed')
    expect(result.interrupted).toBe(false)
    expect(result.failed).toBe(true)
  })

  it('treats verify partial as interrupted', () => {
    const result = buildMigrationStreamResult(false, RAG_MIGRATION_STATUS.verifyPartial, {
      completed: 1,
      total: 10
    })
    expect(result.outcome).toBe('interrupted')
    expect(result.interrupted).toBe(true)
  })

  it('treats dimension failure as failed', () => {
    const result = buildMigrationStreamResult(false, RAG_MIGRATION_STATUS.dimensionCheckFailed, {
      message: '401'
    })
    expect(result.outcome).toBe('failed')
    expect(result.interrupted).toBe(false)
  })
})
