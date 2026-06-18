import { describe, it, expect } from 'vitest'
import {
  buildFlutterLegacySummaryMarkdown,
  importLegacySqlSummariesForVault
} from '../legacy-summary-migration.util'

describe('legacy-summary-migration.util', () => {
  it('buildFlutterLegacySummaryMarkdown matches old Flutter frontmatter layout', () => {
    const markdown = buildFlutterLegacySummaryMarkdown({
      id: 3,
      type: 'weekly',
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2024-01-07T00:00:00.000Z'),
      content: '本周总结正文',
      generatedAt: new Date('2024-01-08T12:00:00.000Z'),
      sourceIds: ['diary-1']
    })

    expect(markdown).toContain('type: weekly')
    expect(markdown).toContain('startDate: 2024-01-01T00:00:00.000Z')
    expect(markdown).toContain('sourceIds:')
    expect(markdown.endsWith('本周总结正文')).toBe(true)
  })

  it('exports legacy SQL summaries into Archives markdown files', async () => {
    const writes: string[] = []
    const result = await importLegacySqlSummariesForVault({
      fileSystem: {
        exists: async (p: string) => String(p).includes('baishou.sqlite'),
        mkdir: async () => undefined,
        writeFile: async (filePath: string) => {
          writes.push(filePath)
        }
      } as never,
      sourceRoot: '/legacy',
      targetRoot: '/target',
      legacyVaultName: 'Personal',
      sqliteClient: {},
      resolveTargetVaultName: async () => 'Personal',
      executeRawSql: async (_client, sql) => {
        if (sql.includes('ATTACH')) return { rows: [] }
        if (sql.includes('PRAGMA')) return { rows: [{ name: 'id' }] }
        if (sql.includes('SELECT * FROM')) {
          return {
            rows: [
              {
                id: 1,
                type: 'weekly',
                start_date: 1704067200000,
                end_date: 1704672000000,
                content: 'SQL 总结',
                generated_at: 1704715200000,
                source_ids: 'a,b'
              }
            ]
          }
        }
        return { rows: [] }
      }
    })

    expect(result.imported).toBe(1)
    expect(writes.some((p) => p.includes('/target/Personal/Archives/Weekly/'))).toBe(true)
  })
})
