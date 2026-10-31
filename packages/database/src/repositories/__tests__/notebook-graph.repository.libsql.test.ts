import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { Client } from '@libsql/client'
import { notebookGraphNodeIdForEntity } from '@baishou/shared'
import type { NotebookGraphRepository } from '../notebook-graph.repository'
import {
  createNotebookGraphLibsqlFixture,
  disposeNotebookGraphLibsqlFixture,
  type NotebookGraphLibsqlFixture
} from './notebook-graph.repository.test-helpers'

describe('NotebookGraphRepository applyRawNode (libsql)', () => {
  let fixture: NotebookGraphLibsqlFixture
  let client: Client
  let repo: NotebookGraphRepository

  beforeEach(async () => {
    fixture = await createNotebookGraphLibsqlFixture()
    client = fixture.client
    repo = fixture.repo
  })

  afterEach(() => {
    disposeNotebookGraphLibsqlFixture(fixture)
  })

  it('同名唯一冲突时改到内容寻址 id 并改边', async () => {
    const now = Date.now()
    const stable = notebookGraphNodeIdForEntity('v1', 'nb1', 'person', '小明')
    await repo.applyRawNode({
      id: 'legacy-random',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '小明',
      aliases: ['明明'],
      createdAt: now,
      updatedAt: now,
      shardMonth: '2026-08'
    })
    await repo.applyRawEdge({
      id: 'e-legacy',
      vaultId: 'v1',
      notebookId: 'nb1',
      fromId: 'legacy-random',
      toId: 'legacy-random',
      edgeType: 'relates_to',
      shardMonth: '2026-08',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawNode({
      id: stable,
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '小明',
      aliases: ['小明同学'],
      createdAt: now + 1,
      updatedAt: now + 1,
      shardMonth: '2026-08'
    })
    const view = await repo.getView({ vaultId: 'v1', notebookId: 'nb1' })
    expect(view.nodes.map((n) => n.id)).toEqual([stable])
    expect(view.edges[0]?.fromId).toBe(stable)
    expect(view.edges[0]?.toId).toBe(stable)
  })

  it('getView returns every node when maxNodes is unlimited', async () => {
    const now = Date.now()
    for (let i = 0; i < 6; i++) {
      await repo.applyRawNode({
        id: `unlim-${i}`,
        vaultId: 'v1',
        notebookId: 'nb1',
        nodeType: 'person',
        name: `人${i}`,
        createdAt: now,
        updatedAt: now,
        shardMonth: '2026-08'
      })
    }
    const unlimited = await repo.getView({ vaultId: 'v1', notebookId: 'nb1', maxNodes: -1 })
    expect(unlimited.nodes).toHaveLength(6)
  })

  it('已有内容寻址 id 时不把随机 id 翻过来', async () => {
    const now = Date.now()
    const stable = notebookGraphNodeIdForEntity('v1', 'nb1', 'person', '小明')
    await repo.applyRawNode({
      id: stable,
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '小明',
      aliases: ['张三'],
      createdAt: now,
      updatedAt: now,
      shardMonth: '2026-03'
    })
    const result = await repo.applyRawNode({
      id: 'legacy-random',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '小明',
      aliases: ['小张'],
      createdAt: now + 1,
      updatedAt: now + 1,
      shardMonth: '2026-04'
    })
    expect(result.id).toBe(stable)
    expect(result.remappedFrom).toBe('legacy-random')
    const view = await repo.getView({ vaultId: 'v1', notebookId: 'nb1' })
    expect(view.nodes.map((n) => n.id)).toEqual([stable])
    const aliases = JSON.parse(String(view.nodes[0]?.aliases ?? '[]')) as string[]
    expect(aliases).toEqual(expect.arrayContaining(['张三', '小张']))
  })

  it('lists pending nodes and edges, and reads an edge by id', async () => {
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-pending',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '甲',
      reviewStatus: 'pending',
      createdAt: now,
      updatedAt: now,
      shardMonth: 'src1'
    })
    await repo.applyRawNode({
      id: 'n-ready',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '乙',
      reviewStatus: 'approved',
      createdAt: now,
      updatedAt: now,
      shardMonth: 'src1'
    })
    await repo.applyRawEdge({
      id: 'e-pending',
      vaultId: 'v1',
      notebookId: 'nb1',
      fromId: 'n-pending',
      toId: 'n-ready',
      edgeType: 'mentions',
      confidence: 42,
      reviewStatus: 'pending',
      shardMonth: 'src1',
      createdAt: now,
      updatedAt: now
    })
    const pendingNodes = await repo.listPendingNodes('v1', 'nb1')
    const pendingEdges = await repo.listPendingEdges('v1', 'nb1')
    const edge = await repo.getEdgeById('e-pending', 'v1', 'nb1')
    expect(pendingNodes.map((row) => row.id)).toEqual(['n-pending'])
    expect(pendingEdges.map((row) => row.id)).toEqual(['e-pending'])
    expect(edge?.edgeType).toBe('mentions')
  })

  it('should allow two same-type same-name notebook nodes when discriminators differ', async () => {
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-bare',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawNode({
      id: 'n-split',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三',
      discriminator: '同事',
      createdAt: now,
      updatedAt: now
    })
    expect((await repo.getNodeById('n-bare', 'v1', 'nb1'))?.discriminator).toBe('')
    expect((await repo.getNodeById('n-split', 'v1', 'nb1'))?.discriminator).toBe('同事')
  })

  it('should reject two same-type same-name notebook nodes when discriminators also match', async () => {
    const now = Date.now()
    await client.execute({
      sql: `INSERT INTO notebook_graph_nodes (
        id, vault_id, notebook_id, node_type, name, name_normalized, discriminator,
        aliases, summary, props_json, mention_count, origin, shard_month, review_status,
        created_at, updated_at
      ) VALUES ('n-a', 'v1', 'nb1', 'person', '张三', '张三', '同事', '[]', '', '{}', 1, 'ai', '', 'approved', ?, ?)`,
      args: [now, now]
    })
    await expect(
      client.execute({
        sql: `INSERT INTO notebook_graph_nodes (
          id, vault_id, notebook_id, node_type, name, name_normalized, discriminator,
          aliases, summary, props_json, mention_count, origin, shard_month, review_status,
          created_at, updated_at
        ) VALUES ('n-b', 'v1', 'nb1', 'person', '张三', '张三', '同事', '[]', '', '{}', 1, 'ai', '', 'approved', ?, ?)`,
        args: [now, now]
      })
    ).rejects.toThrow()
  })

  it('should return both same-name notebook nodes with the bare name first when finding by name', async () => {
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-split',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三',
      discriminator: '同事',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawNode({
      id: 'n-bare',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三',
      createdAt: now,
      updatedAt: now
    })
    const rows = await repo.findNodesByNameOrAlias('v1', 'nb1', '张三', 'person')
    expect(rows.map((row) => row.id)).toEqual(['n-bare', 'n-split'])
  })

  it('should return the bare-name notebook node when findNodeByName sees two same-name people', async () => {
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-split',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三',
      discriminator: '同事',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawNode({
      id: 'n-bare',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三',
      createdAt: now,
      updatedAt: now
    })
    const hit = await repo.findNodeByName('v1', 'nb1', '张三', 'person')
    expect(hit?.id).toBe('n-bare')
  })

  it('should return multiple notebook nodes when the same alias hits more than one person', async () => {
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-bare',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三甲',
      aliases: ['张三'],
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawNode({
      id: 'n-split',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三乙',
      aliases: ['张三'],
      discriminator: '同事',
      createdAt: now,
      updatedAt: now
    })
    const rows = await repo.findNodesByNameOrAlias('v1', 'nb1', '张三', 'person')
    expect(rows.map((row) => row.id)).toEqual(['n-bare', 'n-split'])
  })

  it('should keep a discriminated applyRawNode beside the bare-name notebook row without remapping', async () => {
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-bare',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三',
      createdAt: now,
      updatedAt: now
    })
    const result = await repo.applyRawNode({
      id: 'n-split',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三',
      discriminator: '同事',
      createdAt: now + 1,
      updatedAt: now + 1
    })
    expect(result.remappedFrom).toBeUndefined()
    expect(result.id).toBe('n-split')
    expect(await repo.getNodeById('n-bare', 'v1', 'nb1')).not.toBeNull()
    expect((await repo.getNodeById('n-split', 'v1', 'nb1'))?.discriminator).toBe('同事')
  })

  it('should persist an empty-string discriminator when notebook applyRawNode omits it', async () => {
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-empty',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '李四',
      createdAt: now,
      updatedAt: now
    })
    const mapped = await repo.getNodeById('n-empty', 'v1', 'nb1')
    expect(mapped?.discriminator).toBe('')
    const raw = await client.execute({
      sql: 'SELECT discriminator FROM notebook_graph_nodes WHERE id = ?',
      args: ['n-empty']
    })
    expect(raw.rows[0]?.discriminator).toBe('')
    expect(raw.rows[0]?.discriminator).not.toBeNull()
  })

  it('should replace notebook node aliases when applyRawNode receives origin=user and keep union when origin=ai', async () => {
    const now = Date.now()
    await repo.applyRawNode({
      id: 'nb-merged',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '小李',
      aliases: ['李某', '小张'],
      origin: 'user',
      createdAt: now,
      updatedAt: now,
      shardMonth: '2026-08'
    })

    await repo.applyRawNode({
      id: 'nb-merged',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '小李',
      aliases: ['李某'],
      origin: 'user',
      createdAt: now,
      updatedAt: now + 1,
      shardMonth: '2026-08'
    })

    const afterUser = await repo.getNodeById('nb-merged', 'v1', 'nb1')
    expect(JSON.parse(String(afterUser?.aliases ?? '[]'))).toEqual(['小李', '李某'])
    expect(await repo.findNodesByNameOrAlias('v1', 'nb1', '小张', 'person')).toHaveLength(0)
  })
})
