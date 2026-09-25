import { describe, expect, it, vi } from 'vitest'
import { notebookGraphNodeIdForEntity } from '@baishou/shared'
import {
  createNotebookGraphIdentity,
  createNotebookGraphMergeWriter,
  mergeNotebookGraphNodes,
  NOTEBOOK_GRAPH_FORBIDDEN_ANCHOR_TYPES
} from '../notebook-graph-workspace'

describe('notebook graph workspace adapter', () => {
  it('should expose identity ports that salt node ids with notebookId and forbid source anchors', () => {
    const identity = createNotebookGraphIdentity({ vaultId: 'v1', notebookId: 'nb1' })
    expect(identity.kind).toBe('notebook')
    expect(identity.forbiddenAnchorTypes).toEqual(NOTEBOOK_GRAPH_FORBIDDEN_ANCHOR_TYPES)
    expect(identity.nodeIdForEntity('person', '甲')).toBe(
      notebookGraphNodeIdForEntity('v1', 'nb1', 'person', '甲')
    )
    expect(identity.nodeIdForEntity('person', '甲')).not.toBe(
      notebookGraphNodeIdForEntity('v1', 'nb2', 'person', '甲')
    )
  })

  it('should stamp notebookId on merge writes and reject source anchors', async () => {
    const writes: Array<{ collection: string; record: Record<string, unknown> }> = []
    const manager = {
      writeNode: vi.fn(async (record: Record<string, unknown>) => {
        writes.push({ collection: 'nodes', record })
      }),
      writeEdge: vi.fn(async (record: Record<string, unknown>) => {
        writes.push({ collection: 'edges', record })
      }),
      removeRecordsFromShard: vi.fn(async () => 1)
    }
    const repo = {
      getNodeById: vi.fn(async (id: string) => {
        if (id === 'surv') {
          return {
            id: 'surv',
            vaultId: 'v1',
            nodeType: 'person',
            name: '张三',
            aliases: '["张三"]',
            summary: '',
            propsJson: '{}',
            mentionCount: 1,
            firstSeenAt: 10,
            lastSeenAt: 20,
            origin: 'ai',
            shardMonth: 'src1',
            reviewStatus: 'approved',
            createdAt: 10
          }
        }
        if (id === 'lose') {
          return {
            id: 'lose',
            vaultId: 'v1',
            nodeType: 'person',
            name: '小张',
            aliases: ['小张'],
            summary: '',
            propsJson: '{}',
            mentionCount: 1,
            firstSeenAt: 5,
            lastSeenAt: 15,
            origin: 'ai',
            shardMonth: 'src1',
            reviewStatus: 'pending',
            createdAt: 5
          }
        }
        if (id === 'src' || id === 'src2') {
          return {
            id,
            vaultId: 'v1',
            nodeType: 'source',
            name: id === 'src' ? '资料' : '资料二',
            aliases: [],
            summary: '',
            propsJson: '{}',
            mentionCount: 1,
            firstSeenAt: 1,
            lastSeenAt: 1,
            origin: 'ai',
            shardMonth: 'src1',
            reviewStatus: 'approved',
            createdAt: 1
          }
        }
        return null
      }),
      listEdgesTouching: vi.fn(async () => [])
    }

    await mergeNotebookGraphNodes({
      vaultId: 'v1',
      vaultName: 'Personal',
      notebookId: 'nb1',
      survivorId: 'surv',
      loserId: 'lose',
      now: 100,
      manager: manager as never,
      repo: repo as never
    })

    const survivor = writes.find((row) => row.collection === 'nodes' && row.record.id === 'surv')
    expect(survivor?.record.notebookId).toBe('nb1')
    expect(survivor?.record.aliases).toEqual(expect.arrayContaining(['张三', '小张']))
    expect(manager.removeRecordsFromShard).toHaveBeenCalledWith('nb1', 'nodes', 'src1', ['lose'])

    await expect(
      mergeNotebookGraphNodes({
        vaultId: 'v1',
        vaultName: 'Personal',
        notebookId: 'nb1',
        survivorId: 'src',
        loserId: 'src2',
        manager: manager as never,
        repo: repo as never
      })
    ).rejects.toThrow('资料锚点不能合并')
  })

  it('should stamp notebookId when the merge writer receives a memory-shaped record', async () => {
    const writeNode = vi.fn(async () => undefined)
    const writer = createNotebookGraphMergeWriter(
      {
        writeNode,
        writeEdge: vi.fn(),
        removeRecordsFromShard: vi.fn(async () => 0)
      },
      'nb9'
    )
    await writer.writeRecord(
      {
        id: 'n1',
        schemaVersion: 1,
        vaultId: 'v1',
        vaultName: 'Personal',
        nodeType: 'person',
        name: '甲',
        aliases: [],
        summary: '',
        props: {},
        mentionCount: 1,
        firstSeenAt: 1,
        lastSeenAt: 1,
        origin: 'ai',
        shardMonth: 'src1',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null
      },
      { collection: 'nodes' }
    )
    expect(writeNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1', notebookId: 'nb9' }))
  })
})
