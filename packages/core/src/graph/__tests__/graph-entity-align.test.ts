import { describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity } from '@baishou/shared'
import {
  alignEntityPool,
  alignedEmbeddingForNodeCard,
  buildEntityAlignPrompt,
  parseEntityAlignDecisions,
  parseNameCandidateDecision
} from '../graph-entity-align'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

describe('alignEntityPool', () => {
  it('reuses exact name hits before calling embed or the judge', async () => {
    const embedQuery = vi.fn()
    const judgeMerges = vi.fn()
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const out = await alignEntityPool([{ name: '小明', nodeType: 'person', summary: '同学' }], {
      findCandidatesByNameOrAlias: async () => [
        {
          id: existingId,
          name: '小明',
          aliases: ['小明同学']
        }
      ],
      embedQuery,
      judgeMerges,
      nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
    })
    expect(out.get('person\0小明')?.id).toBe(existingId)
    expect(out.get('person\0小明')?.mergedBy).toBe('name')
    expect(out.get('person\0小明')?.ambiguous).toBeFalsy()
    expect(out.get('person\0小明')?.embedding).toBeUndefined()
    expect(out.get('person\0小明')?.embedText).toBeUndefined()
    expect(embedQuery).not.toHaveBeenCalled()
    expect(judgeMerges).not.toHaveBeenCalled()
  })

  it('does not hard-merge similar names when the judge is missing', async () => {
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
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      }
    )
    expect(out.get('person\0小张')?.mergedBy).toBe('create')
    expect(out.get('person\0张三')?.mergedBy).toBe('create')
    expect(out.get('person\0小张')?.id).not.toBe(dbId)
    expect(out.get('person\0张三')?.id).toBe(graphNodeIdForEntity(VAULT, 'person', '张三'))
    expect(out.get('person\0小张')?.embedding).toEqual([1, 0])
    expect(out.get('person\0小张')?.embedText).toBe('小张\n同事')
  })

  it('should pass clipped sourceContext to judgeMerges when the diary excerpt is present', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const longContext = `今天见到小张。${'甲'.repeat(900)}`
    const judgeMerges = vi.fn().mockResolvedValue({ merges: [], uncertain: [] })
    await alignEntityPool(
      [
        {
          name: '小张',
          nodeType: 'person',
          summary: '同事',
          sourceContext: longContext
        }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges
      }
    )
    expect(judgeMerges).toHaveBeenCalledWith(
      expect.objectContaining({
        incoming: [
          expect.objectContaining({
            ref: 'i1',
            name: '小张',
            sourceContext: longContext.slice(0, 800)
          })
        ]
      })
    )
    expect(String(judgeMerges.mock.calls[0]?.[0]?.incoming?.[0]?.sourceContext ?? '').length).toBe(
      800
    )
  })

  it('should create a new node and attach similarPending when the judge returns uncertain', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const judgeMerges = vi.fn().mockResolvedValue({
      merges: [],
      uncertain: [
        {
          incomingRef: 'i1',
          existingRef: 'e1',
          reason: '像同一个人但又不敢并',
          similarity: 0.72
        }
      ]
    })
    const out = await alignEntityPool(
      [
        {
          name: '小张',
          nodeType: 'person',
          summary: '同事',
          sourceContext: '今天见到小张，有点像张三'
        }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges
      }
    )
    const created = out.get('person\0小张')
    expect(created?.mergedBy).toBe('create')
    expect(created?.reused).toBe(false)
    expect(created?.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小张'))
    expect(created?.id).not.toBe(dbId)
    expect(created?.similarPending).toEqual(
      expect.objectContaining({
        peerId: dbId,
        similarity: 0.72,
        reason: '像同一个人但又不敢并',
        sourceExcerpt: '今天见到小张，有点像张三'
      })
    )
    expect(created?.similarPending?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('lets a second LLM call merge incoming names onto an existing node', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const judgeMerges = vi.fn().mockResolvedValue([
      { incomingRef: 'i1', existingRef: 'e1' },
      { incomingRef: 'i2', sameAsIncomingRef: 'i1' }
    ])
    const out = await alignEntityPool(
      [
        { name: '小张', nodeType: 'person', summary: '同事' },
        { name: '张三丰', nodeType: 'person', summary: '同事小张' }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [
          { id: dbId, name: '张三', aliases: ['三哥'], nodeType: 'person', distance: 0.35 }
        ],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges
      }
    )
    expect(judgeMerges).toHaveBeenCalledWith(
      expect.objectContaining({
        incoming: expect.arrayContaining([
          expect.objectContaining({ ref: 'i1', name: '小张' }),
          expect.objectContaining({ ref: 'i2', name: '张三丰' })
        ]),
        existing: [expect.objectContaining({ ref: 'e1', name: '张三', id: dbId })]
      })
    )
    expect(out.get('person\0小张')?.id).toBe(dbId)
    expect(out.get('person\0张三丰')?.id).toBe(dbId)
    expect(out.get('person\0小张')?.mergedBy).toBe('llm')
    expect(out.get('person\0小张')?.aliases).toEqual(
      expect.arrayContaining(['小张', '张三丰', '三哥'])
    )
    expect(out.get('person\0小张')?.embedding).toEqual([1, 0])
    expect(out.get('person\0小张')?.embedText).toBe('小张\n同事')
  })

  it('does not recall a 50% vector hit for the judge', async () => {
    const judgeMerges = vi.fn().mockResolvedValue([])
    await alignEntityPool(
      [
        { name: '杭州', nodeType: 'place', summary: '城市' },
        { name: '西湖', nodeType: 'place', summary: '景点' }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [
          { id: 'other', name: '上海', aliases: [], nodeType: 'place', distance: 0.5 }
        ],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges
      }
    )
    expect(judgeMerges).toHaveBeenCalledWith(expect.objectContaining({ existing: [] }))
  })

  it('creates a new node when the judge leaves a close vector hit out of merges', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const out = await alignEntityPool([{ name: '小张', nodeType: 'person', summary: '同事' }], {
      findCandidatesByNameOrAlias: async () => [],
      embedQuery: async () => [1, 0],
      searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
      nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
      judgeMerges: async () => []
    })
    expect(out.get('person\0小张')?.mergedBy).toBe('create')
    expect(out.get('person\0小张')?.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小张'))
    expect(out.get('person\0小张')?.id).not.toBe(dbId)
    expect(out.get('person\0小张')?.similarPending).toBeUndefined()
  })

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
})

describe('alignedEmbeddingForNodeCard', () => {
  it('should return the vector when embed text equals the node card', () => {
    expect(
      alignedEmbeddingForNodeCard({ embedding: [1, 0], embedText: '小张\n同事' }, '小张', '同事')
    ).toEqual({ embedding: [1, 0], text: '小张\n同事' })
  })

  it('should return null when the node card differs', () => {
    expect(
      alignedEmbeddingForNodeCard({ embedding: [1, 0], embedText: '小张\n同事' }, '张三', '同事')
    ).toBeNull()
  })

  it('should return null when alignment did not compute a vector', () => {
    expect(alignedEmbeddingForNodeCard(undefined, '小张', '同事')).toBeNull()
    expect(
      alignedEmbeddingForNodeCard({ embedding: undefined, embedText: undefined }, '小张', '同事')
    ).toBeNull()
  })
})

describe('buildEntityAlignPrompt', () => {
  it('should include sourceContext and uncertain in the judge prompt', () => {
    const prompt = buildEntityAlignPrompt({
      incoming: [
        {
          ref: 'i1',
          name: '小张',
          nodeType: 'person',
          aliases: [],
          summary: '同事',
          sourceContext: '日记正文片段'
        }
      ],
      existing: [
        { ref: 'e1', id: 'n1', name: '张三', nodeType: 'person', aliases: [], summary: '' }
      ]
    })
    expect(prompt.user).toContain('日记正文片段')
    expect(prompt.user).toContain('sourceContext')
    expect(prompt.user).toContain('uncertain')
    expect(prompt.user).toContain('吃不准')
  })
})

describe('parseEntityAlignDecisions', () => {
  it('reads incoming/existing/same_as from the second-pass JSON', () => {
    const parsed = parseEntityAlignDecisions(
      '```json\n{"merges":[{"incoming":"i1","existing":"e1"},{"incoming":"i2","same_as":"i1"}]}\n```'
    )
    expect(parsed).toEqual({
      merges: [
        { incomingRef: 'i1', existingRef: 'e1', sameAsIncomingRef: undefined },
        { incomingRef: 'i2', existingRef: undefined, sameAsIncomingRef: 'i1' }
      ],
      uncertain: []
    })
  })

  it('should read uncertain rows from the second-pass JSON', () => {
    const parsed = parseEntityAlignDecisions(
      '{"merges":[],"uncertain":[{"incoming":"i1","existing":"e1","reason":"吃不准","similarity":0.72}]}'
    )
    expect(parsed).toEqual({
      merges: [],
      uncertain: [{ incomingRef: 'i1', existingRef: 'e1', reason: '吃不准', similarity: 0.72 }]
    })
  })

  it('returns null for extract-shaped JSON so commit creates new nodes', () => {
    expect(
      parseEntityAlignDecisions(
        JSON.stringify({
          entities: [{ name: '小张', type: 'person' }],
          edges: []
        })
      )
    ).toBeNull()
  })
})

describe('parseNameCandidateDecision', () => {
  it('should read the candidate id from the judge JSON', () => {
    expect(parseNameCandidateDecision('{"id":"node-split"}')).toBe('node-split')
    expect(parseNameCandidateDecision('```json\n{"candidateId":"node-split"}\n```')).toBe(
      'node-split'
    )
  })

  it('should return null when the model leaves the id empty', () => {
    expect(parseNameCandidateDecision('{"id":null}')).toBeNull()
    expect(parseNameCandidateDecision('{"id":""}')).toBeNull()
    expect(parseNameCandidateDecision('not-json')).toBeNull()
  })
})
