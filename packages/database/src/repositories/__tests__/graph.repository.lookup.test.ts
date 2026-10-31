import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { entityAlignKey } from '@baishou/shared'
import type { Client } from '@libsql/client'
import type { GraphRepository } from '../graph.repository'
import {
  OTHER,
  VAULT,
  createGraphFixture,
  disposeGraphFixture,
  type GraphFixture
} from './graph.repository.test-helpers'

describe('GraphRepository name lookup', () => {
  let fixture: GraphFixture
  let client: Client
  let repo: GraphRepository
  let seedNode: GraphFixture['seedNode']

  beforeEach(async () => {
    fixture = await createGraphFixture()
    client = fixture.client
    repo = fixture.repo
    seedNode = fixture.seedNode
  })

  afterEach(() => {
    disposeGraphFixture(fixture)
  })

  it('findNodeByNameOrAlias uses equality on name_normalized / alias table', async () => {
    await seedNode('n-ming', { name: '小明', aliases: ['小明同学'], mentionCount: 3 })
    await seedNode('n-other-vault', { vaultId: OTHER, name: '小明' })

    const byName = await repo.findNodeByNameOrAlias(VAULT, '  小明  ', 'person')
    expect(byName?.id).toBe('n-ming')

    const byAlias = await repo.findNodeByNameOrAlias(VAULT, '小明同学', 'person')
    expect(byAlias?.id).toBe('n-ming')

    const partial = await repo.findNodeByNameOrAlias(VAULT, '明', 'person')
    expect(partial).toBeNull()

    const otherType = await repo.findNodeByNameOrAlias(VAULT, '小明', 'place')
    expect(otherType).toBeNull()

    const otherVault = await repo.findNodeByNameOrAlias(OTHER, '小明', 'person')
    expect(otherVault?.id).toBe('n-other-vault')
  })

  it('untyped findNodeByNameOrAlias is equality-only and fail-closed across types', async () => {
    await seedNode('n-ming', { name: '小明', aliases: ['小明同学'] })
    await seedNode('n-similar', { name: '小明哥' })
    expect((await repo.findNodeByNameOrAlias(VAULT, '小明'))?.id).toBe('n-ming')
    expect((await repo.findNodeByNameOrAlias(VAULT, '小明同学'))?.id).toBe('n-ming')
    expect(await repo.findNodeByNameOrAlias(VAULT, '明')).toBeNull()

    await seedNode('p-apple', { name: '苹果', nodeType: 'person' })
    await seedNode('t-apple', { name: '苹果', nodeType: 'topic' })
    expect(await repo.findNodeByNameOrAlias(VAULT, '苹果')).toBeNull()
    expect((await repo.findNodeByNameOrAlias(VAULT, '苹果', 'person'))?.id).toBe('p-apple')
  })

  it('should allow two same-type same-name nodes when discriminators differ', async () => {
    await seedNode('n-bare', { name: '张三' })
    await seedNode('n-split', { name: '张三', discriminator: '同事' })
    expect((await repo.getNodeById('n-bare', VAULT))?.discriminator).toBe('')
    expect((await repo.getNodeById('n-split', VAULT))?.discriminator).toBe('同事')
  })

  it('should reject two same-type same-name nodes when discriminators also match', async () => {
    await seedNode('n-a', { name: '张三', discriminator: '同事' })
    await expect(seedNode('n-b', { name: '张三', discriminator: '同事' })).rejects.toThrow()
  })

  it('should return both same-name nodes with the bare name first when finding by name', async () => {
    await seedNode('n-split', { name: '张三', discriminator: '同事' })
    await seedNode('n-bare', { name: '张三' })
    const rows = await repo.findNodesByNameOrAlias(VAULT, '张三', 'person')
    expect(rows.map((row) => row.id)).toEqual(['n-bare', 'n-split'])
  })

  it('should return the bare-name node when findNodeByNameOrAlias sees two same-name people', async () => {
    await seedNode('n-split', { name: '张三', discriminator: '同事' })
    await seedNode('n-bare', { name: '张三' })
    const hit = await repo.findNodeByNameOrAlias(VAULT, '张三', 'person')
    expect(hit?.id).toBe('n-bare')
  })

  it('should return multiple nodes when the same alias hits more than one person', async () => {
    await seedNode('n-bare', { name: '张三甲', aliases: ['张三'] })
    await seedNode('n-split', { name: '张三乙', aliases: ['张三'], discriminator: '同事' })
    const rows = await repo.findNodesByNameOrAlias(VAULT, '张三', 'person')
    expect(rows.map((row) => row.id)).toEqual(['n-bare', 'n-split'])
  })

  it('should list only pending nodes that already have a suspectReason', async () => {
    await repo.upsertNode({
      id: 'n-suspect',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '可疑',
      shardMonth: '2026-03',
      reviewStatus: 'pending',
      propsJson: JSON.stringify({ suspectReason: '同时挂了两家公司' })
    })
    await repo.upsertNode({
      id: 'n-pending',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '仅待审',
      shardMonth: '2026-03',
      reviewStatus: 'pending',
      propsJson: JSON.stringify({})
    })
    await repo.upsertNode({
      id: 'n-approved',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '已通过',
      shardMonth: '2026-03',
      reviewStatus: 'approved',
      propsJson: JSON.stringify({ suspectReason: '不应出现' })
    })
    const suspects = await repo.listSuspectNodes(VAULT)
    expect(suspects.map((row) => row.id)).toEqual(['n-suspect'])
    const scan = await repo.listLiveScanGraph(VAULT)
    expect(scan.nodes.map((row) => row.id).sort()).toEqual(['n-approved', 'n-pending', 'n-suspect'])
    expect(scan.nodes.every((row) => row.origin && row.reviewStatus)).toBe(true)
  })

  it('should persist an empty-string discriminator when upsert omits it', async () => {
    await repo.upsertNode({
      id: 'n-empty',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '李四',
      shardMonth: '2026-03'
    })
    const mapped = await repo.getNodeById('n-empty', VAULT)
    expect(mapped?.discriminator).toBe('')
    const raw = await client.execute({
      sql: 'SELECT discriminator FROM graph_nodes WHERE id = ?',
      args: ['n-empty']
    })
    expect(raw.rows[0]?.discriminator).toBe('')
    expect(raw.rows[0]?.discriminator).not.toBeNull()
  })

  it('should resolve name and alias hits in batch with bare discriminator first', async () => {
    await seedNode('n-split', { name: '张三', discriminator: '同事', aliases: ['三哥'] })
    await seedNode('n-bare', { name: '张三', aliases: ['小张'] })
    await seedNode('n-place', { name: '杭州', nodeType: 'place', aliases: ['武林'] })
    await seedNode('n-other', { vaultId: OTHER, name: '张三' })

    const batch = await repo.findNodesByNamesOrAliasesBatch(VAULT, [
      { name: '  张三  ', type: 'person' },
      { name: '小张', type: 'person' },
      { name: '三哥', type: 'person' },
      { name: '武林', type: 'place' },
      { name: '武林', type: 'person' },
      { name: '不存在', type: 'person' }
    ])

    expect(batch.get(entityAlignKey('person', '张三'))?.map((r) => r.id)).toEqual([
      'n-bare',
      'n-split'
    ])
    expect(batch.get(entityAlignKey('person', '小张'))?.map((r) => r.id)).toEqual(['n-bare'])
    expect(batch.get(entityAlignKey('person', '三哥'))?.map((r) => r.id)).toEqual(['n-split'])
    expect(batch.get(entityAlignKey('place', '武林'))?.map((r) => r.id)).toEqual(['n-place'])
    expect(batch.get(entityAlignKey('person', '武林'))).toEqual([])
    expect(batch.get(entityAlignKey('person', '不存在'))).toEqual([])
  })
})
