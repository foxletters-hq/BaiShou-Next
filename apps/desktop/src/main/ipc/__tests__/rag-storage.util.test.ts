import { describe, expect, it } from 'vitest'
import {
  SAFETY_BACKUP_TABLE,
  isSafetyBackupTableName,
  parseSafetyBackupCreatedAt
} from '../rag-storage.util'

describe('rag-storage.util', () => {
  it('should accept only safety-backup table names', () => {
    expect(isSafetyBackupTableName(`${SAFETY_BACKUP_TABLE}_2026-09-18T11-22-33-456Z`)).toBe(true)
    expect(isSafetyBackupTableName('memory_embeddings')).toBe(false)
  })

  it('should restore ISO-like timestamp when the hyphenated suffix matches', () => {
    expect(parseSafetyBackupCreatedAt(`${SAFETY_BACKUP_TABLE}-2026-09-18T11-22-33-456Z`)).toBe(
      '2026-09-18T11:22:33.456Z'
    )
  })

  it('should return unknown when the table name does not contain the hyphen suffix', () => {
    expect(parseSafetyBackupCreatedAt(`${SAFETY_BACKUP_TABLE}_2026-09-18T11-22-33-456Z`)).toBe(
      'unknown'
    )
  })
})
