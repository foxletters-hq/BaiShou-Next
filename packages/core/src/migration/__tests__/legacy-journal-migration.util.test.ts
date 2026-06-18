import { describe, it, expect } from 'vitest'
import {
  buildJournalFilePathFromDateStr,
  importLegacyJournalToDisk,
  legacyJournalAlreadyMigrated,
  normalizeJournalFileRaw
} from '../legacy-journal-migration.util'

describe('legacy-journal-migration.util', () => {
  const dateStr = '2024-01-15'
  const legacy = `---\ndate: 2024-01-15\n---\n\nhello legacy`
  const exactCopy = legacy
  const mergedTarget = `---\ndate: 2024-01-15\nid: 99\n---\n\nhello legacy\n\nextra from merge`
  const different = `---\ndate: 2024-01-15\n---\n\nother content`

  it('buildJournalFilePathFromDateStr uses YYYY/MM layout', () => {
    expect(buildJournalFilePathFromDateStr('/root/Journals', dateStr)).toBe(
      '/root/Journals/2024/01/2024-01-15.md'
    )
  })

  it('normalizeJournalFileRaw unifies line endings', () => {
    expect(normalizeJournalFileRaw('a\r\nb\r\n')).toBe('a\nb')
  })

  it('detects exact file match via md5', () => {
    expect(legacyJournalAlreadyMigrated(legacy, exactCopy, dateStr)).toBe(true)
  })

  it('detects merged target that already contains legacy body', () => {
    expect(legacyJournalAlreadyMigrated(legacy, mergedTarget, dateStr)).toBe(true)
  })

  it('returns false when target content differs', () => {
    expect(legacyJournalAlreadyMigrated(legacy, different, dateStr)).toBe(false)
  })

  it('importLegacyJournalToDisk writes legacy raw when target is missing', async () => {
    const writes: Array<{ path: string; content: string }> = []
    const fileSystem = {
      exists: async () => false,
      mkdir: async () => undefined,
      writeFile: async (p: string, content: string) => {
        writes.push({ path: p, content })
      }
    } as never

    const outcome = await importLegacyJournalToDisk(
      fileSystem,
      '/vault/Journals',
      dateStr,
      legacy,
      null
    )

    expect(outcome).toBe('imported')
    expect(writes).toHaveLength(1)
    expect(writes[0]?.content).toBe(legacy)
  })
})
