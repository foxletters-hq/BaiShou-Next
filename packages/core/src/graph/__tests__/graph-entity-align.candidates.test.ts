import { describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity } from '@baishou/shared'
import { alignEntityPool } from '../graph-entity-align'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

describe('alignEntityPool', () => {
  it('creates new nodes when the judge returns null instead of hard-merging', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const out = await alignEntityPool(
      [
        { name: '小张', nodeType: 'person', summary: '同事' },
        { name: '张三', nodeType: 'person', summary: '同事张三' }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges: async () => null
      }
    )
    expect(out.get('person\0小张')?.mergedBy).toBe('create')
    expect(out.get('person\0张三')?.mergedBy).toBe('create')
    expect(out.get('person\0小张')?.id).not.toBe(dbId)
  })

  it('should leave the entity unresolved then create when name lookup returns no candidates', async () => {
    const out = await alignEntityPool([{ name: '小红', nodeType: 'person', summary: '同学' }], {
      findCandidatesByNameOrAlias: async () => [],
      nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
    })
    expect(out.get('person\0小红')?.reused).toBe(false)
    expect(out.get('person\0小红')?.mergedBy).toBe('create')
    expect(out.get('person\0小红')?.ambiguous).toBeFalsy()
    expect(out.get('person\0小红')?.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小红'))
  })

  it('should reuse the single candidate and keep ambiguous false when name lookup returns one row', async () => {
    const existingId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const out = await alignEntityPool([{ name: '张三', nodeType: 'person', summary: '同事' }], {
      findCandidatesByNameOrAlias: async () => [
        { id: existingId, name: '张三', aliases: ['三哥'], summary: '老友' }
      ],
      nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
    })
    expect(out.get('person\0张三')).toEqual(
      expect.objectContaining({
        id: existingId,
        canonicalName: '张三',
        reused: true,
        mergedBy: 'name',
        ambiguous: false
      })
    )
  })

  it('should reuse the bare-name id and mark ambiguous when name lookup returns two rows', async () => {
    const bareId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const splitId = graphNodeIdForEntity(VAULT, 'person', '张三', '同事')
    const embedQuery = vi.fn()
    const judgeMerges = vi.fn()
    const out = await alignEntityPool(
      [{ name: '张三', nodeType: 'person', summary: '日记里的张三' }],
      {
        findCandidatesByNameOrAlias: async () => [
          { id: bareId, name: '张三', aliases: ['张三'] },
          { id: splitId, name: '张三乙', aliases: ['张三'] }
        ],
        embedQuery,
        judgeMerges,
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      }
    )
    expect(out.get('person\0张三')).toEqual(
      expect.objectContaining({
        id: bareId,
        canonicalName: '张三',
        reused: true,
        mergedBy: 'name',
        ambiguous: true
      })
    )
    expect(out.get('person\0张三')?.id).not.toBe(splitId)
    expect(embedQuery).not.toHaveBeenCalled()
    expect(judgeMerges).not.toHaveBeenCalled()
  })

  it('should reuse the judged candidate id and keep ambiguous false when the name judge picks a split entity', async () => {
    const bareId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const splitId = graphNodeIdForEntity(VAULT, 'person', '张三', '同事')
    const judgeMerges = vi.fn()
    const judgeNameCandidates = vi.fn().mockResolvedValue(splitId)
    const out = await alignEntityPool(
      [{ name: '张三', nodeType: 'person', summary: '日记里的同事张三' }],
      {
        findCandidatesByNameOrAlias: async () => [
          { id: bareId, name: '张三', aliases: ['张三'], discriminator: '' },
          { id: splitId, name: '张三', aliases: ['张三'], discriminator: '同事' }
        ],
        judgeMerges,
        judgeNameCandidates,
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      }
    )
    expect(out.get('person\0张三')).toEqual(
      expect.objectContaining({
        id: splitId,
        reused: true,
        mergedBy: 'llm',
        ambiguous: false
      })
    )
    expect(judgeMerges).not.toHaveBeenCalled()
    expect(judgeNameCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        incoming: expect.objectContaining({ name: '张三' }),
        candidates: expect.arrayContaining([
          expect.objectContaining({ id: bareId }),
          expect.objectContaining({ id: splitId })
        ])
      })
    )
  })

  it('should reuse the bare-name id and mark ambiguous when the name judge returns null', async () => {
    const bareId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const splitId = graphNodeIdForEntity(VAULT, 'person', '张三', '同事')
    const out = await alignEntityPool(
      [{ name: '张三', nodeType: 'person', summary: '日记里的张三' }],
      {
        findCandidatesByNameOrAlias: async () => [
          { id: bareId, name: '张三', aliases: ['张三'] },
          { id: splitId, name: '张三乙', aliases: ['张三'] }
        ],
        judgeNameCandidates: async () => null,
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      }
    )
    expect(out.get('person\0张三')).toEqual(
      expect.objectContaining({
        id: bareId,
        mergedBy: 'name',
        ambiguous: true
      })
    )
  })

  it('should reuse the bare-name id and mark ambiguous when the name judge throws', async () => {
    const bareId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const splitId = graphNodeIdForEntity(VAULT, 'person', '张三', '同事')
    const out = await alignEntityPool(
      [{ name: '张三', nodeType: 'person', summary: '日记里的张三' }],
      {
        findCandidatesByNameOrAlias: async () => [
          { id: bareId, name: '张三', aliases: ['张三'] },
          { id: splitId, name: '张三乙', aliases: ['张三'] }
        ],
        judgeNameCandidates: async () => {
          throw new Error('model down')
        },
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      }
    )
    expect(out.get('person\0张三')).toEqual(
      expect.objectContaining({
        id: bareId,
        mergedBy: 'name',
        ambiguous: true
      })
    )
  })

  it('should reuse the bare-name id and mark ambiguous when the name judge returns an id not in candidates', async () => {
    const bareId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const splitId = graphNodeIdForEntity(VAULT, 'person', '张三', '同事')
    const out = await alignEntityPool(
      [{ name: '张三', nodeType: 'person', summary: '日记里的张三' }],
      {
        findCandidatesByNameOrAlias: async () => [
          { id: bareId, name: '张三', aliases: ['张三'] },
          { id: splitId, name: '张三乙', aliases: ['张三'] }
        ],
        judgeNameCandidates: async () => 'invented-id',
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      }
    )
    expect(out.get('person\0张三')).toEqual(
      expect.objectContaining({
        id: bareId,
        mergedBy: 'name',
        ambiguous: true
      })
    )
  })

  it('should rethrow embedQuery errors when requireEmbedQuery is set', async () => {
    await expect(
      alignEntityPool([{ name: '小红', nodeType: 'person', summary: '同学' }], {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => {
          throw new Error('Payment Required')
        },
        requireEmbedQuery: true,
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      })
    ).rejects.toThrow('Payment Required')
  })

  it('should keep creating a node when embedQuery fails and is optional', async () => {
    const out = await alignEntityPool([{ name: '小红', nodeType: 'person', summary: '同学' }], {
      findCandidatesByNameOrAlias: async () => [],
      embedQuery: async () => {
        throw new Error('Payment Required')
      },
      nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
    })
    expect(out.get('person\0小红')?.mergedBy).toBe('create')
  })
})
