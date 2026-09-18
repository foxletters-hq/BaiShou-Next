import { describe, expect, it, vi } from 'vitest'
import { entityAlignKey, graphNodeIdForEntity } from '@baishou/shared'
import { persistGraphExtractDraft } from '../graph-llm-extraction.persist'
import type { GraphExtractDraft } from '../graph-llm-extraction.types'
import type { AlignedEntity } from '../graph-entity-align.types'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

function draft(): GraphExtractDraft {
  return {
    vaultId: VAULT,
    vaultName: '个人',
    filePath: 'Journal/2026-09-19.md',
    contentHash: 'h1',
    hash: 'h1',
    dateStr: '2026-09-19',
    shardMonth: '2026-09',
    validFrom: 1,
    entities: [{ name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }],
    edges: [],
    sourceContext: '今天见到小张'
  }
}

describe('persistGraphExtractDraft similarPending', () => {
  it('should write similarPending on the new node without forcing pending review', async () => {
    const written: Array<Record<string, unknown>> = []
    const newId = graphNodeIdForEntity(VAULT, 'person', '小张')
    const aligned = new Map<string, AlignedEntity>([
      [
        entityAlignKey('person', '小张'),
        {
          key: entityAlignKey('person', '小张'),
          id: newId,
          canonicalName: '小张',
          aliases: ['小张'],
          summary: '同事',
          reused: false,
          mergedBy: 'create',
          similarPending: {
            peerId: 'peer-1',
            similarity: 0.72,
            reason: '吃不准',
            sourceExcerpt: '今天见到小张',
            createdAt: '2026-09-19T00:00:00.000Z'
          }
        }
      ]
    ])
    await persistGraphExtractDraft(
      {
        repo: {
          getNodeById: vi.fn(async () => null),
          findNodesByNameOrAlias: vi.fn(async () => []),
          listEdgesTouching: vi.fn(async () => [])
        } as never,
        graphManager: {
          writeRecord: vi.fn(async (record: Record<string, unknown>) => {
            written.push(record)
          }),
          supersedeAiEdgesBySourceRef: vi.fn(async () => 0)
        } as never
      },
      draft(),
      aligned,
      100
    )
    const person = written.find((row) => row.nodeType === 'person')
    expect(person?.id).toBe(newId)
    expect(person?.reviewStatus).toBe('approved')
    expect(person?.props).toEqual(
      expect.objectContaining({
        similarPending: {
          peerId: 'peer-1',
          similarity: 0.72,
          reason: '吃不准',
          sourceExcerpt: '今天见到小张',
          createdAt: '2026-09-19T00:00:00.000Z'
        }
      })
    )
  })

  it('should not write similarPending when alignment did not mark the entity', async () => {
    const written: Array<Record<string, unknown>> = []
    const newId = graphNodeIdForEntity(VAULT, 'person', '小张')
    const aligned = new Map<string, AlignedEntity>([
      [
        entityAlignKey('person', '小张'),
        {
          key: entityAlignKey('person', '小张'),
          id: newId,
          canonicalName: '小张',
          aliases: ['小张'],
          summary: '同事',
          reused: false,
          mergedBy: 'create'
        }
      ]
    ])
    await persistGraphExtractDraft(
      {
        repo: {
          getNodeById: vi.fn(async () => null),
          findNodesByNameOrAlias: vi.fn(async () => []),
          listEdgesTouching: vi.fn(async () => [])
        } as never,
        graphManager: {
          writeRecord: vi.fn(async (record: Record<string, unknown>) => {
            written.push(record)
          }),
          supersedeAiEdgesBySourceRef: vi.fn(async () => 0)
        } as never
      },
      draft(),
      aligned,
      100
    )
    const person = written.find((row) => row.nodeType === 'person')
    expect(
      (person?.props as { similarPending?: unknown } | undefined)?.similarPending
    ).toBeUndefined()
  })
})
