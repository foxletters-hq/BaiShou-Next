import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { GraphRepository } from '../graph.repository'
import {
  GRAPH_EDGES_CREATE_SQL,
  GRAPH_INDEXES_SQL,
  GRAPH_NODE_ALIASES_CREATE_SQL,
  GRAPH_NODES_CREATE_SQL
} from '../../agent-schema-compat'

export const VAULT = 'vlt_aaaaaaaaaaaaaaaa'
export const OTHER = 'vlt_bbbbbbbbbbbbbbbb'

export type SeedNodeOptions = {
  vaultId?: string
  nodeType?: string
  name: string
  aliases?: string[]
  mentionCount?: number
  shardMonth?: string
  reviewStatus?: 'approved' | 'pending' | 'rejected'
  discriminator?: string
}

export type SeedEdgeOptions = {
  shardMonth?: string
  vaultId?: string
  reviewStatus?: 'approved' | 'pending' | 'rejected'
}

export type GraphFixture = {
  client: Client
  repo: GraphRepository
  seedNode: (id: string, opts: SeedNodeOptions) => Promise<void>
  seedEdge: (id: string, fromId: string, toId: string, opts?: SeedEdgeOptions) => Promise<void>
}

/** 每条用例一个内存库，避免跨用例串数据。 */
export async function createGraphFixture(): Promise<GraphFixture> {
  const client = createClient({ url: ':memory:' })
  await client.execute(GRAPH_NODES_CREATE_SQL)
  await client.execute(GRAPH_NODE_ALIASES_CREATE_SQL)
  await client.execute(GRAPH_EDGES_CREATE_SQL)
  for (const sql of GRAPH_INDEXES_SQL) await client.execute(sql)
  const repo = new GraphRepository(drizzle(client) as never)

  const seedNode = async (id: string, opts: SeedNodeOptions) => {
    await repo.upsertNode({
      id,
      forceId: true,
      vaultId: opts.vaultId ?? VAULT,
      nodeType: opts.nodeType ?? 'person',
      name: opts.name,
      aliases: opts.aliases ?? [],
      mentionCount: opts.mentionCount ?? 1,
      shardMonth: opts.shardMonth ?? '2026-03',
      reviewStatus: opts.reviewStatus ?? 'approved',
      discriminator: opts.discriminator
    })
  }

  const seedEdge = async (id: string, fromId: string, toId: string, opts?: SeedEdgeOptions) => {
    await repo.upsertEdge({
      id,
      vaultId: opts?.vaultId ?? VAULT,
      fromId,
      toId,
      edgeType: 'relates_to',
      shardMonth: opts?.shardMonth ?? '2026-03',
      isCurrent: true,
      sourceKind: 'diary',
      sourceRef: '2026-03-15',
      origin: 'ai',
      reviewStatus: opts?.reviewStatus ?? 'approved'
    })
  }

  return { client, repo, seedNode, seedEdge }
}

export function disposeGraphFixture(fixture: GraphFixture | undefined): void {
  fixture?.client.close()
}
