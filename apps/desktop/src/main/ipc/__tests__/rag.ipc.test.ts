import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { filterUnindexedDiaries } from '@baishou/shared'

describe('filterUnindexedDiaries', () => {
  it('should filter out diaries that are already indexed and not modified', () => {
    const diaries = [
      { id: 1, content: 'diary 1', updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 2, content: 'diary 2', updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 3, content: 'diary 3', updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set(['1', '2', '3'])
    const embeddedUpdatedAtMap = new Map<string, number>([
      ['1', new Date('2026-05-20T00:00:00Z').getTime()],
      ['2', new Date('2026-05-20T00:00:00Z').getTime()],
      ['3', new Date('2026-05-20T00:00:00Z').getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(0)
  })

  it('should include diaries that have never been indexed', () => {
    const diaries = [
      { id: 1, content: 'diary 1', updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 2, content: 'diary 2', updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set(['1'])
    const embeddedUpdatedAtMap = new Map<string, number>([
      ['1', new Date('2026-05-20T00:00:00Z').getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(2)
  })

  it('should include diaries that have been modified after indexing', () => {
    const diaries = [
      { id: 1, content: 'diary 1 modified', updatedAt: new Date('2026-05-21T00:00:00Z') },
      { id: 2, content: 'diary 2', updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set(['1', '2'])
    const embeddedUpdatedAtMap = new Map<string, number>([
      ['1', new Date('2026-05-20T00:00:00Z').getTime()],
      ['2', new Date('2026-05-20T00:00:00Z').getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(1)
  })

  it('should include diaries that are indexed but lack metadata updated_at', () => {
    const diaries = [
      { id: 1, content: 'diary 1', updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 2, content: 'diary 2', updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set(['1', '2'])
    const embeddedUpdatedAtMap = new Map<string, number>()

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(2)
  })
})

describe('desktop embedding provider reuse', () => {
  it('should reuse the registry instance instead of removing it before every embed', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../rag.ipc.ts'), 'utf8')
    expect(src).toContain('getOrUpdateProvider(normalized)')
    expect(src).not.toContain('removeProvider(providerId)')
    expect(src).not.toContain('Resolving embedding provider for migration')
  })
})

describe('rag batch embed progress wiring', () => {
  it('freezes diary totals from the planned batch instead of growing them with completed', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../rag-build.ipc.ts'), 'utf8')
    expect(src).toContain('applyFrozenPhaseProgress')
    expect(src).not.toContain('Math.max(counts.diaries, completed)')
    expect(src).toContain('const diaryResult = await runControlledDiaryBatchEmbed')
  })
})
