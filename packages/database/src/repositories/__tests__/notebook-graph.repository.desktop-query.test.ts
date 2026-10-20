import { expect, it, beforeEach, afterEach } from 'vitest'
import {
  createNotebookGraphDesktopFixture,
  describeGraph,
  disposeNotebookGraphDesktopFixture,
  type NotebookGraphDesktopFixture
} from './notebook-graph.repository.test-helpers'

describeGraph('NotebookGraphRepository desktop queries', () => {
  let fixture: NotebookGraphDesktopFixture

  beforeEach(async () => {
    fixture = await createNotebookGraphDesktopFixture()
  })

  afterEach(() => {
    disposeNotebookGraphDesktopFixture(fixture)
  })

  it('should return every node when maxNodes is unlimited on the desktop knowledge driver', async () => {
    const { repo } = fixture
    const now = Date.now()
    for (let i = 0; i < 6; i++) {
      await repo.applyRawNode({
        id: `desk-unlim-${i}`,
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

  it('同名不同类型查找 fail-closed；带类型可命中', async () => {
    const { repo } = fixture
    const now = Date.now()
    await repo.applyRawNode({
      id: 'p1',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '苹果',
      createdAt: now,
      updatedAt: now
    })
    await repo.applyRawNode({
      id: 't1',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'topic',
      name: '苹果',
      createdAt: now,
      updatedAt: now
    })
    expect(await repo.findNodeByName('v1', 'nb1', '苹果')).toBeNull()
    expect((await repo.findNodeByName('v1', 'nb1', '苹果', 'person'))?.id).toBe('p1')
    expect((await repo.findNodeByName('v1', 'nb1', '苹果', 'topic'))?.id).toBe('t1')
  })

  it('单锚点邻域不含无关节点', async () => {
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
    await repo.applyRawNode({
      id: 'c',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'topic',
      name: '无关',
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
    const view = await repo.getNeighborhood({
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeId: 'a'
    })
    expect(view.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
    expect(view.edges.map((e) => e.id)).toEqual(['e-ab'])
    const unlimited = await repo.getNeighborhood({
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeId: 'a',
      maxNodes: -1
    })
    expect(unlimited.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
    const touching = await repo.listEdgesTouching('v1', 'nb1', 'a')
    expect(touching.map((e) => e.id)).toEqual(['e-ab'])
  })

  it('searchNodes 命中别名表', async () => {
    const { repo } = fixture
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-alias',
      vaultId: 'v1',
      notebookId: 'nb1',
      nodeType: 'person',
      name: '张三',
      aliases: ['小张'],
      createdAt: now,
      updatedAt: now,
      shardMonth: '2026-08'
    })
    const hits = await repo.searchNodes({ vaultId: 'v1', notebookId: 'nb1', query: '小张' })
    expect(hits.map((n) => n.id)).toContain('n-alias')
  })

  it('listNodesPage 与 countNodes 分页与关键字过滤正常工作', async () => {
    const { repo } = fixture
    const now = Date.now()
    for (let i = 1; i <= 5; i++) {
      await repo.applyRawNode({
        id: `node-${i}`,
        vaultId: 'v1',
        notebookId: 'nb1',
        nodeType: 'topic',
        name: `实体_${i}`,
        summary: i === 3 ? '特别的摘要' : undefined,
        mentionCount: i * 10,
        createdAt: now,
        updatedAt: now,
        shardMonth: 'src1'
      })
    }
    const total = await repo.countNodes({ vaultId: 'v1', notebookId: 'nb1' })
    expect(total).toBe(5)

    const page1 = await repo.listNodesPage({
      vaultId: 'v1',
      notebookId: 'nb1',
      limit: 2,
      offset: 0
    })
    expect(page1.length).toBe(2)
    // 降序排列 mentionCount 最大排前面
    expect(page1[0]!.id).toBe('node-5')
    expect(page1[1]!.id).toBe('node-4')

    const page2 = await repo.listNodesPage({
      vaultId: 'v1',
      notebookId: 'nb1',
      limit: 2,
      offset: 2
    })
    expect(page2.length).toBe(2)
    expect(page2[0]!.id).toBe('node-3')

    const keywordHits = await repo.listNodesPage({
      vaultId: 'v1',
      notebookId: 'nb1',
      keyword: '特别',
      limit: 10,
      offset: 0
    })
    expect(keywordHits.length).toBe(1)
    expect(keywordHits[0]!.id).toBe('node-3')

    const edgeCount = await repo.countCurrentEdges({ vaultId: 'v1', notebookId: 'nb1' })
    expect(edgeCount).toBe(0)
  })
})
