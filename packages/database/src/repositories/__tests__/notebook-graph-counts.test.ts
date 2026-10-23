import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { ensureKnowledgeSchema } from '../../knowledge-schema.shared'
import { KnowledgeRepository } from '../knowledge.repository'
import { NotebookGraphRepository } from '../notebook-graph.repository'

describe('KnowledgeRepository.listNotebookGraphCounts', () => {
  let client: Client
  let repo: KnowledgeRepository
  let graph: NotebookGraphRepository

  beforeEach(async () => {
    client = createClient({ url: ':memory:' })
    await ensureKnowledgeSchema(client, '[NotebookGraphCountsTest]')
    const db = drizzle(client)
    repo = new KnowledgeRepository(db as never)
    graph = new NotebookGraphRepository(db as never)
    await repo.createNotebook({ id: 'nb1', name: '本', vaultId: 'vault-a' })
  })

  afterEach(() => {
    client.close()
  })

  it('should count entity nodes and current edges when source placeholders exist', async () => {
    const now = Date.now()
    await graph.applyRawNode({
      id: 'src',
      vaultId: 'vault-a',
      notebookId: 'nb1',
      nodeType: 'source',
      name: '资料',
      createdAt: now,
      updatedAt: now,
      shardMonth: '2026-09'
    })
    await graph.applyRawNode({
      id: 'person',
      vaultId: 'vault-a',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '小明',
      createdAt: now,
      updatedAt: now,
      shardMonth: '2026-09'
    })
    await graph.applyRawEdge({
      id: 'edge',
      vaultId: 'vault-a',
      notebookId: 'nb1',
      fromId: 'person',
      toId: 'src',
      edgeType: 'mentioned_in',
      shardMonth: '2026-09',
      createdAt: now,
      updatedAt: now
    })

    const counts = await repo.listNotebookGraphCounts('vault-a')

    expect(counts).toEqual([{ notebookId: 'nb1', nodes: 1, edges: 1 }])
  })
})
