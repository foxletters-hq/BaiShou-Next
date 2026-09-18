import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { GraphRepository } from '../graph.repository'
import { GraphTraverseOps } from '../graph.repository.traverse'
import {
  GRAPH_EDGES_CREATE_SQL,
  GRAPH_INDEXES_SQL,
  GRAPH_NODE_ALIASES_CREATE_SQL,
  GRAPH_NODES_CREATE_SQL
} from '../../agent-schema-compat'
import { GRAPH_MAX_NEIGHBORS_PER_HOP, GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT } from '@baishou/shared'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

type SqliteDb = { exec(sql: string): unknown; close(): void }
type SqliteCtor = new (filename: string) => SqliteDb

/** traverse 剪枝走的私有方法，测试里按结构签名打桩 */
type NeighborVectorRanker = {
  selectNeighborIdsByVector: (
    vaultId: string,
    candidateIds: string[],
    queryVector: number[],
    limit: number
  ) => Promise<string[]>
}

describe('GraphRepository.traverse prune', () => {
  let client: Client
  let repo: GraphRepository
  let sqlLog: string[]

  async function seedNode(
    id: string,
    opts: {
      name: string
      mentionCount?: number
      embedding?: number[]
      modelId?: string
    }
  ) {
    await repo.upsertNode({
      id,
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: opts.name,
      mentionCount: opts.mentionCount ?? 1,
      embedding: opts.embedding,
      modelId: opts.modelId,
      shardMonth: '2026-03',
      reviewStatus: 'approved'
    })
  }

  async function seedEdge(id: string, fromId: string, toId: string) {
    await repo.upsertEdge({
      id,
      vaultId: VAULT,
      fromId,
      toId,
      edgeType: 'relates_to',
      shardMonth: '2026-03',
      isCurrent: true,
      sourceKind: 'diary',
      sourceRef: '2026-03-15',
      origin: 'ai',
      reviewStatus: 'approved'
    })
  }

  beforeEach(async () => {
    client = createClient({ url: ':memory:' })
    sqlLog = []
    const original = client.execute.bind(client)
    client.execute = (async (stmt: string | { sql: string }) => {
      const sql = typeof stmt === 'string' ? stmt : stmt.sql
      sqlLog.push(sql)
      return original(stmt as never)
    }) as Client['execute']
    await client.execute(GRAPH_NODES_CREATE_SQL)
    await client.execute(GRAPH_NODE_ALIASES_CREATE_SQL)
    await client.execute(GRAPH_EDGES_CREATE_SQL)
    for (const sql of GRAPH_INDEXES_SQL) await client.execute(sql)
    repo = new GraphRepository(drizzle(client) as never)
  })

  afterEach(() => {
    client.close()
  })

  async function seedStar(centerId: string, neighborCount: number, mentionBase = 1) {
    await seedNode(centerId, { name: '中心', mentionCount: 1 })
    for (let i = 0; i < neighborCount; i++) {
      const id = `n-${String(i).padStart(2, '0')}`
      await seedNode(id, { name: `邻${i}`, mentionCount: mentionBase + i })
      await seedEdge(`e-${id}`, centerId, id)
    }
  }

  function assertEdgesCoveredByNodes(view: {
    nodes: Array<{ id: string }>
    edges: Array<{ fromId: string; toId: string }>
  }) {
    const ids = new Set(view.nodes.map((n) => n.id))
    for (const e of view.edges) {
      expect(ids.has(e.fromId)).toBe(true)
      expect(ids.has(e.toId)).toBe(true)
    }
  }

  it('does not prune when maxNeighborsPerHop is omitted (UI / canvas callers)', async () => {
    await seedStar('c-me', GRAPH_MAX_NEIGHBORS_PER_HOP + 8, 1)
    const view = await repo.traverse(VAULT, 'c-me', 1)
    expect(view.nodes).toHaveLength(GRAPH_MAX_NEIGHBORS_PER_HOP + 9)
    expect(view.edges).toHaveLength(GRAPH_MAX_NEIGHBORS_PER_HOP + 8)
  })

  it('skips prune when candidates are at or under the cap and matches uncapped traverse', async () => {
    await seedStar('c-me', 8, 10)
    const baseline = await repo.traverse(VAULT, 'c-me', 1)
    sqlLog.length = 0
    const capped = await repo.traverse(VAULT, 'c-me', 1, {
      maxNeighborsPerHop: GRAPH_MAX_NEIGHBORS_PER_HOP,
      queryVector: [0.1, 0.2, 0.3, 0.4]
    })
    expect(capped.nodes.map((n) => n.id).sort()).toEqual(baseline.nodes.map((n) => n.id).sort())
    expect(capped.edges.map((e) => e.id).sort()).toEqual(baseline.edges.map((e) => e.id).sort())
    expect(sqlLog.some((s) => s.includes('vec_distance_cosine'))).toBe(false)
    expect(sqlLog.some((s) => /order by .*mention_count/i.test(s))).toBe(false)
  })

  it('ranks by mention_count when over the cap and no queryVector is given', async () => {
    await seedStar('c-me', 6, 1)
    const view = await repo.traverse(VAULT, 'c-me', 1, { maxNeighborsPerHop: 3 })
    const neighborIds = view.nodes.filter((n) => n.id !== 'c-me').map((n) => n.id)
    expect(neighborIds).toEqual(['n-05', 'n-04', 'n-03'])
    expect(view.nodes).toHaveLength(4)
    expect(view.edges).toHaveLength(3)
    assertEdgesCoveredByNodes(view)
  })

  it('keeps every returned edge endpoint inside the returned node set', async () => {
    await seedStar('c-me', 10, 1)
    const view = await repo.traverse(VAULT, 'c-me', 1, { maxNeighborsPerHop: 4 })
    assertEdgesCoveredByNodes(view)
    for (const n of view.nodes) {
      expect(n).not.toHaveProperty('embedding')
    }
  })

  it('falls back to mention_count when sqlite-vec is missing and does not scan full node rows', async () => {
    await seedStar('c-me', 6, 1)
    for (let i = 0; i < 6; i++) {
      const id = `n-${String(i).padStart(2, '0')}`
      await repo.upsertNode({
        id,
        forceId: true,
        vaultId: VAULT,
        nodeType: 'person',
        name: `邻${i}`,
        mentionCount: 1 + i,
        embedding: [0.1 * (i + 1), 0.2, 0.3, 0.4],
        modelId: 'mock-embed',
        shardMonth: '2026-03'
      })
    }
    sqlLog.length = 0
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const view = await repo.traverse(VAULT, 'c-me', 1, {
      maxNeighborsPerHop: 3,
      queryVector: [0.6, 0.2, 0.3, 0.4]
    })
    const neighborIds = view.nodes.filter((n) => n.id !== 'c-me').map((n) => n.id)
    expect(neighborIds).toEqual(['n-05', 'n-04', 'n-03'])
    const nodeSelects = sqlLog.filter((s) => /from\s+["']?graph_nodes["']?/i.test(s))
    expect(nodeSelects.some((s) => s.includes('vec_distance_cosine'))).toBe(true)
    expect(
      nodeSelects.some(
        (s) =>
          /mention_count/i.test(s) &&
          /limit/i.test(s) &&
          !/embedding/i.test(s.split('from')[0] ?? '')
      )
    ).toBe(true)
    expect(
      nodeSelects.some((s) =>
        new RegExp(`limit\\s+${GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT}`, 'i').test(s)
      )
    ).toBe(false)
    expect(warn.mock.calls.some((c) => String(c[0]).includes('sqlite-vec unavailable'))).toBe(true)
    warn.mockRestore()
  })

  it('prunes every hop so depth-2 candidates come from the hop-1 kept set', async () => {
    await seedNode('c-me', { name: '中心', mentionCount: 1 })
    for (let i = 0; i < 5; i++) {
      const hop1 = `h1-${i}`
      await seedNode(hop1, { name: `一跳${i}`, mentionCount: 10 + i })
      await seedEdge(`e-c-${hop1}`, 'c-me', hop1)
      for (let j = 0; j < 4; j++) {
        const hop2 = `h2-${i}-${j}`
        await seedNode(hop2, { name: `二跳${i}-${j}`, mentionCount: 100 + i * 10 + j })
        await seedEdge(`e-${hop1}-${hop2}`, hop1, hop2)
      }
    }
    const view = await repo.traverse(VAULT, 'c-me', 2, { maxNeighborsPerHop: 2 })
    const hop1 = view.nodes
      .filter((n) => n.id.startsWith('h1-'))
      .map((n) => n.id)
      .sort()
    expect(hop1).toEqual(['h1-3', 'h1-4'])
    const hop2 = view.nodes.filter((n) => n.id.startsWith('h2-'))
    expect(hop2.every((n) => n.id.startsWith('h2-3-') || n.id.startsWith('h2-4-'))).toBe(true)
    expect(
      hop2.some(
        (n) => n.id.startsWith('h2-0-') || n.id.startsWith('h2-1-') || n.id.startsWith('h2-2-')
      )
    ).toBe(false)
    expect(hop2).toHaveLength(2)
    assertEdgesCoveredByNodes(view)
  })

  it('calls resolveQueryVector at most once across two pruned hops', async () => {
    await seedNode('c-me', { name: '中心', mentionCount: 1 })
    for (let i = 0; i < 5; i++) {
      const hop1 = `h1-${i}`
      await seedNode(hop1, { name: `一跳${i}`, mentionCount: 10 + i })
      await seedEdge(`e-c-${hop1}`, 'c-me', hop1)
      for (let j = 0; j < 4; j++) {
        const hop2 = `h2-${i}-${j}`
        await seedNode(hop2, { name: `二跳${i}-${j}`, mentionCount: 1 })
        await seedEdge(`e-${hop1}-${hop2}`, hop1, hop2)
      }
    }
    const resolveQueryVector = vi.fn(async () => [0.1, 0.2, 0.3, 0.4])
    await repo.traverse(VAULT, 'c-me', 2, {
      maxNeighborsPerHop: 2,
      resolveQueryVector
    })
    expect(resolveQueryVector).toHaveBeenCalledTimes(1)
  })

  it('keeps neighbors in vector-rank order when the SQL vector path succeeds', async () => {
    await seedStar('c-me', 5, 50)
    // 向量排序在遍历职责里，打桩必须打到实际执行的类上
    const spy = vi
      .spyOn(
        GraphTraverseOps.prototype as unknown as NeighborVectorRanker,
        'selectNeighborIdsByVector'
      )
      .mockResolvedValue(['n-01', 'n-03'])
    const view = await repo.traverse(VAULT, 'c-me', 1, {
      maxNeighborsPerHop: 2,
      queryVector: [0.1, 0.2, 0.3, 0.4]
    })
    expect(spy).toHaveBeenCalled()
    expect(view.nodes.filter((n) => n.id !== 'c-me').map((n) => n.id)).toEqual(['n-01', 'n-03'])
    expect(view.edges).toHaveLength(2)
    assertEdgesCoveredByNodes(view)
    spy.mockRestore()
  })

  it('does not call resolveQueryVector when the first hop is under the cap', async () => {
    await seedStar('c-me', 3, 1)
    const resolveQueryVector = vi.fn(async () => [0.1, 0.2, 0.3, 0.4])
    await repo.traverse(VAULT, 'c-me', 1, {
      maxNeighborsPerHop: 8,
      resolveQueryVector
    })
    expect(resolveQueryVector).not.toHaveBeenCalled()
  })
})

describe('GraphRepository.traverse vector prune (sqlite-vec)', () => {
  it('returns maxNeighborsPerHop neighbors ordered by vector distance', async (ctx) => {
    // better-sqlite3 是原生模块，本机 Node ABI 不匹配时整段跳过，因此只能动态导入
    let DatabaseCtor: SqliteCtor
    let loadVec: (db: SqliteDb) => void
    try {
      DatabaseCtor = ((await import('better-sqlite3')) as unknown as { default: SqliteCtor })
        .default
      loadVec = ((await import('sqlite-vec')) as unknown as { load: (db: SqliteDb) => void }).load
    } catch {
      ctx.skip()
      return
    }
    let sqliteDb: SqliteDb
    try {
      sqliteDb = new DatabaseCtor(':memory:')
      loadVec(sqliteDb)
    } catch {
      ctx.skip()
      return
    }
    sqliteDb.exec(GRAPH_NODES_CREATE_SQL)
    sqliteDb.exec(GRAPH_NODE_ALIASES_CREATE_SQL)
    sqliteDb.exec(GRAPH_EDGES_CREATE_SQL)
    for (const ddl of GRAPH_INDEXES_SQL) sqliteDb.exec(ddl)
    const { drizzle: drizzleBetter } = await import('drizzle-orm/better-sqlite3')
    const repo = new GraphRepository(drizzleBetter(sqliteDb as never) as never)
    const VA = 'vlt_aaaaaaaaaaaaaaaa'
    await repo.upsertNode({
      id: 'c-me',
      forceId: true,
      vaultId: VA,
      nodeType: 'person',
      name: '中心',
      mentionCount: 99,
      embedding: [1, 0, 0, 0],
      modelId: 'mock-embed',
      shardMonth: '2026-03'
    })
    const neighbors: Array<{ id: string; embedding: number[]; mention: number }> = [
      { id: 'n-far', embedding: [0, 1, 0, 0], mention: 90 },
      { id: 'n-mid', embedding: [0.5, 0.5, 0, 0], mention: 80 },
      { id: 'n-near', embedding: [0.95, 0.05, 0, 0], mention: 1 },
      { id: 'n-closest', embedding: [1, 0, 0, 0], mention: 2 },
      { id: 'n-other', embedding: [0, 0, 1, 0], mention: 70 }
    ]
    for (const n of neighbors) {
      await repo.upsertNode({
        id: n.id,
        forceId: true,
        vaultId: VA,
        nodeType: 'person',
        name: n.id,
        mentionCount: n.mention,
        embedding: n.embedding,
        modelId: 'mock-embed',
        shardMonth: '2026-03'
      })
      await repo.upsertEdge({
        id: `e-${n.id}`,
        vaultId: VA,
        fromId: 'c-me',
        toId: n.id,
        edgeType: 'relates_to',
        shardMonth: '2026-03',
        isCurrent: true,
        sourceKind: 'diary',
        sourceRef: '2026-03-15',
        origin: 'ai',
        reviewStatus: 'approved'
      })
    }
    const view = await repo.traverse(VA, 'c-me', 1, {
      maxNeighborsPerHop: 2,
      queryVector: [1, 0, 0, 0]
    })
    const neighborIds = view.nodes.filter((n) => n.id !== 'c-me').map((n) => n.id)
    expect(neighborIds).toEqual(['n-closest', 'n-near'])
    expect(view.edges).toHaveLength(2)
    const ids = new Set(view.nodes.map((n) => n.id))
    for (const e of view.edges) {
      expect(ids.has(e.fromId)).toBe(true)
      expect(ids.has(e.toId)).toBe(true)
    }
    sqliteDb.close()
  })
})

describe('GraphRepository selectNodesByIds projection vs vector fallback', () => {
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

  it('omits embedding on traverse nodes while searchNodesByVector JS fallback can still read it', async () => {
    await repo.upsertNode({
      id: 'n-a',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '甲',
      embedding: [1, 0, 0, 0],
      modelId: 'mock-embed',
      shardMonth: '2026-03'
    })
    await repo.upsertNode({
      id: 'n-b',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '乙',
      embedding: [0, 1, 0, 0],
      modelId: 'mock-embed',
      shardMonth: '2026-03'
    })
    await repo.upsertEdge({
      id: 'e-ab',
      vaultId: VAULT,
      fromId: 'n-a',
      toId: 'n-b',
      edgeType: 'relates_to',
      shardMonth: '2026-03',
      isCurrent: true,
      sourceKind: 'diary',
      sourceRef: '2026-03-15',
      origin: 'ai',
      reviewStatus: 'approved'
    })
    const view = await repo.traverse(VAULT, 'n-a', 1)
    expect(view.nodes.every((n) => !('embedding' in n))).toBe(true)
    const hits = await repo.searchNodesByVector(VAULT, [1, 0, 0, 0], 2)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.id).toBe('n-a')
    expect(hits[0]).toHaveProperty('distance')
    expect(hits[0]).not.toHaveProperty('embedding')
  })
})
