import { describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity, logger } from '@baishou/shared'
import { findOrCreateGraphNode, resolveGraphEndpointId } from '../find-or-create-graph-node'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

describe('findOrCreateGraphNode', () => {
  it('reuses an existing name/alias hit instead of minting a new id', async () => {
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const repo = {
      findNodeByNameOrAlias: vi.fn().mockResolvedValue({
        id: existingId,
        name: '小明',
        aliases: ['小明同学'],
        summary: '老友',
        mentionCount: 5,
        firstSeenAt: 10,
        createdAt: 10,
        shardMonth: '2026-01',
        propsJson: '{}',
        origin: 'ai',
        reviewStatus: 'approved'
      }),
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
    expect(result.id).toBe(existingId)
    expect(result.record.mentionCount).toBe(5)
    expect(result.record.shardMonth).toBe('2026-01')
  })

  it('assigns a stable entity id when the node is new', async () => {
    const repo = {
      findNodeByNameOrAlias: vi.fn().mockResolvedValue(null),
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
    expect(result.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小红'))
    expect(result.record.vaultId).toBe(VAULT)
    expect(result.record.shardMonth).toBe('2026-07')
  })

  it('uses diary seenAt for first/last seen instead of wall clock', async () => {
    const repo = {
      findNodeByNameOrAlias: vi.fn().mockResolvedValue(null),
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
      findNodeByNameOrAlias: vi.fn(),
      getNodeById: vi.fn().mockResolvedValue({
        id: alignedId,
        name: '张三',
        aliases: ['张三'],
        summary: '同事',
        mentionCount: 2,
        firstSeenAt: 10,
        lastSeenAt: 10,
        createdAt: 10,
        shardMonth: '2026-01',
        propsJson: '{}',
        origin: 'ai',
        reviewStatus: 'approved'
      })
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
    expect(repo.findNodeByNameOrAlias).not.toHaveBeenCalled()
  })

  it('keeps origin=user when extract reuses the node with origin=ai', async () => {
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const repo = {
      findNodeByNameOrAlias: vi.fn().mockResolvedValue({
        id: existingId,
        name: '小明',
        aliases: ['小明'],
        summary: '',
        mentionCount: 1,
        firstSeenAt: 10,
        createdAt: 10,
        shardMonth: '2026-01',
        propsJson: '{}',
        origin: 'user',
        reviewStatus: 'approved'
      }),
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
      findNodeByNameOrAlias: vi.fn().mockResolvedValue({
        id: existingId,
        name: '小明',
        aliases: ['小明'],
        summary: '',
        mentionCount: 1,
        firstSeenAt: 10,
        createdAt: 10,
        shardMonth: '2026-01',
        propsJson: '{}',
        origin: 'ai',
        reviewStatus: 'approved'
      }),
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
})

describe('resolveGraphEndpointId', () => {
  it('passes nodeType and warns with role/sourceRef when unresolved', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const repo = {
      findNodeByNameOrAlias: vi.fn().mockResolvedValue(null),
      getNodeById: vi.fn()
    }
    const id = await resolveGraphEndpointId(repo as never, VAULT, '不存在', new Map(), {
      nodeType: 'person',
      role: 'from',
      sourceRef: '2026-08-01'
    })
    expect(id).toBeNull()
    expect(repo.findNodeByNameOrAlias).toHaveBeenCalledWith(VAULT, '不存在', 'person')
    expect(warn).toHaveBeenCalledWith(
      '[graph] unresolved endpoint',
      expect.objectContaining({ role: 'from', nodeType: 'person', sourceRef: '2026-08-01' })
    )
    warn.mockRestore()
  })
})
