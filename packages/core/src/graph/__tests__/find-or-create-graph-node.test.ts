import { describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity, logger } from '@baishou/shared'
import {
  findOrCreateGraphNode,
  resolveGraphEndpointId,
  type ResolveGraphEndpointResult
} from '../find-or-create-graph-node'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

function personRow(id: string, name: string, extra?: Record<string, unknown>) {
  return {
    id,
    name,
    aliases: [name],
    summary: '',
    mentionCount: 1,
    firstSeenAt: 10,
    createdAt: 10,
    shardMonth: '2026-01',
    propsJson: '{}',
    origin: 'ai',
    reviewStatus: 'approved',
    discriminator: '',
    ...extra
  }
}

describe('findOrCreateGraphNode', () => {
  it('reuses an existing name/alias hit instead of minting a new id', async () => {
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const repo = {
      findNodesByNameOrAlias: vi.fn().mockResolvedValue([
        personRow(existingId, '小明', {
          aliases: ['小明同学'],
          summary: '老友',
          mentionCount: 5
        })
      ]),
      getNodeById: vi.fn()
    }
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '  小明  ',
      shardMonth: '2026-07'
    })
    expect(result.reused).toBe(true)
    expect(result.ambiguous).toBe(false)
    expect(result.id).toBe(existingId)
    expect(result.record.mentionCount).toBe(5)
    expect(result.record.shardMonth).toBe('2026-01')
  })

  it('assigns a stable entity id when the node is new', async () => {
    const repo = {
      findNodesByNameOrAlias: vi.fn().mockResolvedValue([]),
      getNodeById: vi.fn()
    }
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '小红',
      shardMonth: '2026-07'
    })
    expect(result.reused).toBe(false)
    expect(result.ambiguous).toBe(false)
    expect(result.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小红'))
    expect(result.record.vaultId).toBe(VAULT)
    expect(result.record.shardMonth).toBe('2026-07')
  })

  it('uses diary seenAt for first/last seen instead of wall clock', async () => {
    const repo = {
      findNodesByNameOrAlias: vi.fn().mockResolvedValue([]),
      getNodeById: vi.fn()
    }
    const seenAt = Date.UTC(2026, 2, 15)
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '小红',
      shardMonth: '2026-03',
      now: Date.UTC(2026, 7, 14),
      seenAt
    })
    expect(result.record.firstSeenAt).toBe(seenAt)
    expect(result.record.lastSeenAt).toBe(seenAt)
    expect(result.record.createdAt).toBe(seenAt)
    expect(result.record.updatedAt).toBe(Date.UTC(2026, 7, 14))
  })

  it('writes an aligned forceId without looking up by extracted name', async () => {
    const alignedId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const repo = {
      findNodesByNameOrAlias: vi.fn(),
      getNodeById: vi.fn().mockResolvedValue(
        personRow(alignedId, '张三', {
          aliases: ['张三'],
          summary: '同事',
          mentionCount: 2,
          lastSeenAt: 10
        })
      )
    }
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '小张',
      aliases: ['小张'],
      shardMonth: '2026-03',
      forceId: alignedId,
      seenAt: 20
    })
    expect(result.id).toBe(alignedId)
    expect(result.reused).toBe(true)
    expect(result.record.aliases).toEqual(expect.arrayContaining(['张三', '小张']))
    expect(repo.findNodesByNameOrAlias).not.toHaveBeenCalled()
    expect(result.ambiguous).toBe(false)
  })

  it('keeps origin=user when extract reuses the node with origin=ai', async () => {
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const repo = {
      findNodesByNameOrAlias: vi
        .fn()
        .mockResolvedValue([personRow(existingId, '小明', { origin: 'user' })]),
      getNodeById: vi.fn()
    }
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '小明',
      shardMonth: '2026-07',
      origin: 'ai'
    })
    expect(result.reused).toBe(true)
    expect(result.record.origin).toBe('user')
  })

  it('upgrades an ai node when incoming origin is user', async () => {
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const repo = {
      findNodesByNameOrAlias: vi.fn().mockResolvedValue([personRow(existingId, '小明')]),
      getNodeById: vi.fn()
    }
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '小明',
      shardMonth: '2026-07',
      origin: 'user'
    })
    expect(result.record.origin).toBe('user')
  })

  it('should keep ambiguous false when name lookup returns no rows', async () => {
    const repo = {
      findNodesByNameOrAlias: vi.fn().mockResolvedValue([]),
      getNodeById: vi.fn()
    }
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '新人',
      shardMonth: '2026-07'
    })
    expect(result.reused).toBe(false)
    expect(result.ambiguous).toBe(false)
  })

  it('should keep ambiguous false when name lookup returns one row', async () => {
    const existingId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const repo = {
      findNodesByNameOrAlias: vi.fn().mockResolvedValue([personRow(existingId, '张三')]),
      getNodeById: vi.fn()
    }
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '张三',
      shardMonth: '2026-07'
    })
    expect(result.id).toBe(existingId)
    expect(result.reused).toBe(true)
    expect(result.ambiguous).toBe(false)
    expect(result.record.discriminator).toBe('')
  })

  it('should reuse the bare-name id and mark ambiguous when name lookup returns two rows', async () => {
    const bareId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const splitId = graphNodeIdForEntity(VAULT, 'person', '张三', '同事')
    const repo = {
      findNodesByNameOrAlias: vi
        .fn()
        .mockResolvedValue([
          personRow(bareId, '张三', { discriminator: '' }),
          personRow(splitId, '张三', { discriminator: '同事', aliases: ['张三'] })
        ]),
      getNodeById: vi.fn()
    }
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '张三',
      shardMonth: '2026-07'
    })
    expect(result.id).toBe(bareId)
    expect(result.id).not.toBe(splitId)
    expect(result.reused).toBe(true)
    expect(result.ambiguous).toBe(true)
    expect(result.record.discriminator).toBe('')
  })

  it('should keep the existing discriminator when rewriting a split node by forceId', async () => {
    const splitId = graphNodeIdForEntity(VAULT, 'person', '张三', '同事')
    const repo = {
      findNodesByNameOrAlias: vi.fn(),
      getNodeById: vi
        .fn()
        .mockResolvedValue(personRow(splitId, '张三', { discriminator: '同事', aliases: ['张三'] }))
    }
    const result = await findOrCreateGraphNode(repo as never, {
      vaultId: VAULT,
      vaultName: 'Personal',
      nodeType: 'person',
      name: '张三',
      shardMonth: '2026-07',
      forceId: splitId
    })
    expect(result.record.id).toBe(splitId)
    expect(result.record.discriminator).toBe('同事')
    expect(result.ambiguous).toBe(false)
  })
})

describe('resolveGraphEndpointId', () => {
  it('passes nodeType and warns with role/sourceRef when unresolved', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const repo = {
      findNodesByNameOrAlias: vi.fn().mockResolvedValue([]),
      getNodeById: vi.fn()
    }
    const resolved = await resolveGraphEndpointId(repo as never, VAULT, '不存在', new Map(), {
      nodeType: 'person',
      role: 'from',
      sourceRef: '2026-08-01'
    })
    expect(resolved).toBeNull()
    expect(repo.findNodesByNameOrAlias).toHaveBeenCalledWith(VAULT, '不存在', 'person')
    expect(warn).toHaveBeenCalledWith(
      '[graph] unresolved endpoint',
      expect.objectContaining({ role: 'from', nodeType: 'person', sourceRef: '2026-08-01' })
    )
    warn.mockRestore()
  })

  it('should return the mapped binding when nameToId already has the name', async () => {
    const repo = {
      findNodesByNameOrAlias: vi.fn(),
      getNodeById: vi.fn()
    }
    const nameToId = new Map<string, ResolveGraphEndpointResult>([
      ['张三', { id: 'mapped-id', ambiguous: true }]
    ])
    const resolved = await resolveGraphEndpointId(repo as never, VAULT, '张三', nameToId)
    expect(resolved).toEqual({ id: 'mapped-id', ambiguous: true })
    expect(repo.findNodesByNameOrAlias).not.toHaveBeenCalled()
  })

  it('should return the first id and keep ambiguous false when name lookup returns one row', async () => {
    const existingId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const repo = {
      findNodesByNameOrAlias: vi.fn().mockResolvedValue([personRow(existingId, '张三')]),
      getNodeById: vi.fn()
    }
    const resolved = await resolveGraphEndpointId(
      repo as never,
      VAULT,
      '张三',
      new Map<string, ResolveGraphEndpointResult>()
    )
    expect(resolved).toEqual({ id: existingId, ambiguous: false })
  })

  it('should return the bare-name id and mark ambiguous when name lookup returns two rows', async () => {
    const bareId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const splitId = graphNodeIdForEntity(VAULT, 'person', '张三', '同事')
    const repo = {
      findNodesByNameOrAlias: vi
        .fn()
        .mockResolvedValue([
          personRow(bareId, '张三'),
          personRow(splitId, '张三', { discriminator: '同事' })
        ]),
      getNodeById: vi.fn()
    }
    const resolved = await resolveGraphEndpointId(
      repo as never,
      VAULT,
      '张三',
      new Map<string, ResolveGraphEndpointResult>()
    )
    expect(resolved).toEqual({ id: bareId, ambiguous: true })
    expect(resolved?.id).not.toBe(splitId)
  })
})
