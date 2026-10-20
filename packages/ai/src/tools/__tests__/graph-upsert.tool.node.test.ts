import { describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity } from '@baishou/shared'
import { GraphUpsertTool } from '../graph-upsert.tool'
import {
  VAULT,
  createGraphToolContext,
  createWriteRecorder
} from './graph-upsert.tool.test-helpers'

describe('GraphUpsertTool write semantics', () => {
  it('reuses existing 小明 and skips edges whose endpoints cannot be resolved', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async (opts: { name: string; nodeType?: string }) => {
          if (opts.name === '小明' || opts.name.includes('小明')) {
            return {
              id: existingId,
              name: '小明',
              nodeType: 'person',
              aliases: ['小明同学'],
              mentionCount: 4,
              firstSeenAt: 100,
              createdAt: 100,
              shardMonth: '2026-01'
            }
          }
          return null
        })
      }
    })

    const text = await tool.execute(
      {
        summary: '记一次见面',
        entities: JSON.stringify([{ name: '小明', type: 'person' }]),
        edges: JSON.stringify([
          { from: '小明', to: '不存在的人', type: 'relates_to' },
          { from: '小明', to: '杭州', type: 'located_at' }
        ]),
        source_ref: '2026-07-01'
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    const edges = writes.filter((w) => w.collection === 'edges')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.record.id).toBe(existingId)
    expect(nodes[0]!.record.mentionCount).toBe(4)
    expect(edges).toHaveLength(0)
    expect(text).toContain('跳过 2')
    expect(text).toContain('reason=missing_node')
    expect(text).toContain('更新节点 1')
  })

  it('accepts native entity/edge arrays', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const ming = graphNodeIdForEntity(VAULT, 'person', '小明')
    const hangzhou = graphNodeIdForEntity(VAULT, 'place', '杭州')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async (opts: { name: string }) => {
          if (opts.name === '小明') return { id: ming, name: '小明', nodeType: 'person' }
          if (opts.name === '杭州') return { id: hangzhou, name: '杭州', nodeType: 'place' }
          return null
        })
      }
    })

    const text = await tool.execute(
      {
        summary: '去杭州',
        entities: [
          { name: '小明', type: 'person' },
          { name: '杭州', type: 'place' }
        ],
        edges: [{ from: '小明', to: '杭州', type: 'located_at' }],
        source_ref: '2026-07-01'
      } as never,
      context
    )

    expect(writes.filter((w) => w.collection === 'nodes')).toHaveLength(2)
    expect(writes.filter((w) => w.collection === 'edges')).toHaveLength(1)
    expect(text).toContain('已写入人生关系图')
  })

  it('does not reuse a node when findNodeByName returns null (no fuzzy host hit)', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => null)
      }
    })

    await tool.execute(
      {
        summary: '记下小明同学',
        entities: JSON.stringify([{ name: '小明同学', type: 'person' }])
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.record.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小明同学'))
  })

  it('keeps origin=user when reusing a hand-edited node', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => ({
          id: existingId,
          name: '小明',
          nodeType: 'person',
          origin: 'user' as const
        }))
      }
    })

    await tool.execute(
      {
        summary: '补一条关系',
        entities: JSON.stringify([{ name: '小明', type: 'person' }])
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes[0]!.record.origin).toBe('user')
  })

  it('writes reviewStatus approved so the change is visible immediately', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      }
    })

    const text = await tool.execute(
      {
        summary: '记一个人',
        entities: JSON.stringify([{ name: '小红', type: 'person' }])
      },
      context
    )
    expect(writes[0]!.record.reviewStatus).toBe('approved')
    expect(text).toContain('已生效')
  })

  it('should keep the existing discriminator when findNodeByName returns a split node', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const splitId = graphNodeIdForEntity(VAULT, 'person', '张三', '同事')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => ({
          id: splitId,
          name: '张三',
          nodeType: 'person',
          discriminator: '同事'
        }))
      }
    })

    await tool.execute(
      {
        summary: '补同事摘要',
        entities: JSON.stringify([{ name: '张三', type: 'person', summary: '同事' }])
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.record.id).toBe(splitId)
    expect(nodes[0]!.record.discriminator).toBe('同事')
  })

  it('should reuse the bare-name id when findNodeByName already returns that node', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const bareId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => ({
          id: bareId,
          name: '张三',
          nodeType: 'person',
          discriminator: ''
        }))
      }
    })

    await tool.execute(
      {
        summary: '记下张三',
        entities: JSON.stringify([{ name: '张三', type: 'person' }])
      },
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes[0]!.record.id).toBe(bareId)
  })

  it('should reject an invalid source_ref date before writing', async () => {
    const writeRecord = vi.fn()
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: { writeRecord, tombstone: vi.fn() }
    })

    const invalidDate = await tool.execute(
      {
        summary: '伪日期',
        entities: [{ name: '测试人物A', type: 'person' }],
        source_ref: '1999-02-31'
      } as never,
      context
    )
    const notADate = await tool.execute(
      {
        summary: '非日期',
        entities: [{ name: '测试人物A', type: 'person' }],
        source_ref: 'not-a-date'
      } as never,
      context
    )

    expect(writeRecord).not.toHaveBeenCalled()
    expect(invalidDate).toContain('source_ref 不是有效日期')
    expect(notADate).toContain('source_ref 不是有效日期')
  })

  it('should collapse newlines in a new node name', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => null)
      }
    })

    const text = await tool.execute(
      {
        summary: '换行名',
        entities: [{ name: '测试节点\n带换行', type: 'person' }]
      } as never,
      context
    )

    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes[0]!.record.name).toBe('测试节点 带换行')
    expect(text).toContain('新建节点 1')
    expect(text).toContain('更新节点 0')
  })

  it('should count a same-name node write as updated not created', async () => {
    const existingId = graphNodeIdForEntity(VAULT, 'person', '测试人物A')
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord: vi.fn()
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => ({
          id: existingId,
          name: '测试人物A',
          nodeType: 'person'
        }))
      }
    })

    const text = await tool.execute(
      {
        summary: '同名更新',
        entities: [{ name: '测试人物A', type: 'person', summary: '新摘要' }]
      } as never,
      context
    )

    expect(text).toContain('新建节点 0')
    expect(text).toContain('更新节点 1')
  })

  it('accepts UUID memory id as source_ref and infers sourceKind as memory', async () => {
    const { writes, writeRecord } = createWriteRecorder()
    const memoryId = 'a8e99bc1-d419-4b68-b7a4-c5a8e0f9b1c2'
    const tool = new GraphUpsertTool()
    const context = createGraphToolContext({
      rawDataSourceManager: {
        writeRecord
      },
      graphNodeLookup: {
        findNodeByName: vi.fn(async () => null)
      }
    })

    const res = await tool.execute(
      {
        summary: '基于记忆沉淀',
        entities: [{ name: '测试记忆节点', type: 'person' }],
        source_ref: memoryId
      } as never,
      context
    )

    expect(res).not.toContain('source_ref 不是有效日期')
    expect(res).toContain('新建节点 1')
    const nodes = writes.filter((w) => w.collection === 'nodes')
    expect(nodes).toHaveLength(1)
  })
})
