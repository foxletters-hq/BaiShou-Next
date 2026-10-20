import { expect, it, beforeEach, afterEach } from 'vitest'
import { notebookGraphNodeIdForEntity } from '@baishou/shared'
import {
  createNotebookGraphDesktopFixture,
  describeGraph,
  disposeNotebookGraphDesktopFixture,
  type NotebookGraphDesktopFixture
} from './notebook-graph.repository.test-helpers'

describeGraph('NotebookGraphRepository desktop mutations', () => {
  let fixture: NotebookGraphDesktopFixture

  beforeEach(async () => {
    fixture = await createNotebookGraphDesktopFixture()
  })

  afterEach(() => {
    disposeNotebookGraphDesktopFixture(fixture)
  })

  it('同资料重抽按 sourceRef 前缀退役旧 AI 边', async () => {
    const { repo } = fixture
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n1',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '小明',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawNode({
      id: 'n2',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'topic',
      name: '对齐',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawEdge({
      id: 'e-old',
      vaultId: 'v1',
      notebookId: 'nb1',
      fromId: 'n1',
      toId: 'n2',
      edgeType: 'mentions',
      origin: 'ai',
      sourceKind: 'knowledge',
      sourceRef: 'src1#0',
      shardMonth: '2026-08',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawEdge({
      id: 'e-new',
      vaultId: 'v1',
      notebookId: 'nb1',
      fromId: 'n1',
      toId: 'n2',
      edgeType: 'relates_to',
      origin: 'ai',
      sourceKind: 'knowledge',
      sourceRef: 'src1#0',
      shardMonth: '2026-08',
      createdAt: now,
      updatedAt: now
    })
    const n = await repo.supersedeAiEdgesBySourcePrefix({
      notebookId: 'nb1',
      sourceRefPrefix: 'src1',
      exceptIds: new Set(['e-new'])
    })
    expect(n).toBe(1)
    const view = await repo.getView({ vaultId: 'v1', notebookId: 'nb1' })
    expect(view.edges.map((e) => e.id)).toEqual(['e-new'])
  })

  it('softDeleteNode 级联删除相连的边', async () => {
    const { repo } = fixture
    const now = Date.now()
    await repo.applyRawNode({
      id: 'a',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '甲',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawNode({
      id: 'b',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '乙',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawEdge({
      id: 'e-ab',
      vaultId: 'v1',
      notebookId: 'nb1',
      fromId: 'a',
      toId: 'b',
      edgeType: 'relates_to',
      origin: 'ai',
      sourceKind: 'knowledge',
      sourceRef: 'src1#0',
      shardMonth: '2026-08',
      createdAt: now,
      updatedAt: now
    })
    await repo.softDeleteNode('a', 'nb1')
    const view = await repo.getView({ vaultId: 'v1', notebookId: 'nb1' })
    expect(view.nodes.map((n) => n.id)).toEqual(['b'])
    expect(view.edges).toEqual([])
  })

  it('删资料时清掉 source 锚点', async () => {
    const { dbManager, repo: graph } = fixture
    const { KnowledgeRepository } = await import('../../repositories/knowledge.repository')
    const { notebookGraphSourceNodeId } = await import('@baishou/shared')
    const knowledge = new KnowledgeRepository(dbManager.getDb() as never)
    const now = Date.now()
    await knowledge.createNotebook({ id: 'nb1', name: '本', vaultId: 'v1' })
    await knowledge.upsertSource({
      id: 'src-del',
      notebookId: 'nb1',
      title: '资料',
      sourceKind: 'text',
      contentHash: 'h',
      status: 'ready',
      vaultId: 'v1'
    })
    const sourceNodeId = notebookGraphSourceNodeId('v1', 'nb1', 'src-del')
    await graph.applyRawNode({
      id: sourceNodeId,
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'source',
      name: '资料',
      createdAt: now,
      updatedAt: now
    })
    await knowledge.deleteSource('src-del')
    const view = await graph.getView({ vaultId: 'v1', notebookId: 'nb1' })
    expect(view.nodes.some((n) => n.id === sourceNodeId)).toBe(false)
  })

  it('deleteAllForVault 清掉 notebook_graph 三表', async () => {
    const { dbManager, repo: graph } = fixture
    const { KnowledgeRepository } = await import('../../repositories/knowledge.repository')
    const knowledge = new KnowledgeRepository(dbManager.getDb() as never)
    const now = Date.now()
    await knowledge.createNotebook({ id: 'nb1', name: '本', vaultId: 'v1' })
    await graph.applyRawNode({
      id: 'n-purge',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '甲',
      createdAt: now,
      updatedAt: now
    })
    await graph.applyRawEdge({
      id: 'e-purge',
      vaultId: 'v1',
      notebookId: 'nb1',
      fromId: 'n-purge',
      toId: 'n-purge',
      edgeType: 'relates_to',
      origin: 'ai',
      sourceKind: 'knowledge',
      sourceRef: 'src1#0',
      shardMonth: '2026-08',
      createdAt: now,
      updatedAt: now
    })
    expect((await graph.getView({ vaultId: 'v1', notebookId: 'nb1' })).nodes).toHaveLength(1)
    await knowledge.deleteAllForVault('v1')
    const view = await graph.getView({ vaultId: 'v1', notebookId: 'nb1' })
    expect(view.nodes).toEqual([])
    expect(view.edges).toEqual([])
    expect(await knowledge.getNotebook('nb1')).toBeNull()
  })

  it('applyRawNode 同名唯一冲突时改到文件 id 并改边', async () => {
    const { repo } = fixture
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

  it('applyRawNode 已有内容寻址 id 时不把随机 id 翻过来', async () => {
    const { repo } = fixture
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

  it('入库时把 0-1 把握的待确认边换成 0-100 已确认', async () => {
    const { repo } = fixture
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n1',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'topic',
      name: '景别',
      createdAt: now,
      updatedAt: now,
      shardMonth: 'src1'
    })
    await repo.applyRawNode({
      id: 'n2',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'topic',
      name: '构图',
      createdAt: now,
      updatedAt: now,
      shardMonth: 'src1'
    })
    await repo.applyRawEdge({
      id: 'e-scale',
      vaultId: 'v1',
      notebookId: 'nb1',
      fromId: 'n1',
      toId: 'n2',
      edgeType: 'relates_to',
      confidence: 1,
      reviewStatus: 'pending',
      shardMonth: 'src1',
      createdAt: now,
      updatedAt: now
    })
    const view = await repo.getView({ vaultId: 'v1', notebookId: 'nb1' })
    expect(view.edges[0]?.confidence).toBe(100)
    expect(view.edges[0]?.reviewStatus).toBe('approved')
  })
})
