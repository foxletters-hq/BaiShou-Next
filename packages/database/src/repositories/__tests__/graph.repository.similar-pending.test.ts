import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { GraphRepository } from '../graph.repository'
import {
  GRAPH_EDGES_CREATE_SQL,
  GRAPH_INDEXES_SQL,
  GRAPH_NODE_ALIASES_CREATE_SQL,
  GRAPH_NODES_CREATE_SQL
} from '../../agent-schema-compat'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

const PENDING = {
  peerId: 'n-old',
  similarity: 0.72,
  reason: '吃不准',
  sourceExcerpt: '今天见到小张',
  createdAt: '2026-09-19T00:00:00.000Z'
}

describe('GraphRepository listSimilarPendingPairs', () => {
  let client: Client
  let repo: GraphRepository

  beforeEach(async () => {
    client = createClient({ url: ':memory:' })
    await client.execute(GRAPH_NODES_CREATE_SQL)
    await client.execute(GRAPH_NODE_ALIASES_CREATE_SQL)
    await client.execute(GRAPH_EDGES_CREATE_SQL)
    for (const sql of GRAPH_INDEXES_SQL) await client.execute(sql)
    repo = new GraphRepository(drizzle(client) as never)
  })

  afterEach(() => {
    client.close()
  })

  it('should list approved similar pairs and ignore suspect-only nodes', async () => {
    await repo.upsertNode({
      id: 'n-old',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '张三',
      shardMonth: '2026-03',
      reviewStatus: 'approved',
      propsJson: '{}'
    })
    await repo.upsertNode({
      id: 'n-new',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '小张',
      shardMonth: '2026-03',
      reviewStatus: 'approved',
      propsJson: JSON.stringify({ similarPending: PENDING })
    })
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

    const pairs = await repo.listSimilarPendingPairs(VAULT)
    expect(pairs).toEqual([
      {
        nodeId: 'n-new',
        nodeName: '小张',
        peerId: 'n-old',
        peerName: '张三',
        similarity: 0.72,
        reason: '吃不准',
        sourceExcerpt: '今天见到小张',
        createdAt: '2026-09-19T00:00:00.000Z'
      }
    ])
    expect(pairs.some((row) => row.nodeId === 'n-suspect')).toBe(false)
  })

  it('should return an empty list after the pair is cleared from props', async () => {
    await repo.upsertNode({
      id: 'n-old',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '张三',
      shardMonth: '2026-03',
      reviewStatus: 'approved'
    })
    await repo.upsertNode({
      id: 'n-new',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '小张',
      shardMonth: '2026-03',
      reviewStatus: 'approved',
      propsJson: JSON.stringify({ similarPending: PENDING })
    })
    expect(await repo.listSimilarPendingPairs(VAULT)).toHaveLength(1)

    await repo.upsertNode({
      id: 'n-new',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '小张',
      shardMonth: '2026-03',
      reviewStatus: 'approved',
      propsJson: '{}'
    })
    expect(await repo.listSimilarPendingPairs(VAULT)).toEqual([])
  })
})
