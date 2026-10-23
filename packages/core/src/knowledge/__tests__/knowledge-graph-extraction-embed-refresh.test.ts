import { describe, expect, it, vi } from 'vitest'
import { graphNodeCardText, type NotebookGraphNodeRawRecord } from '@baishou/shared'
import {
  notebookGraphCardChanged,
  refreshNotebookEmbeddingsAfterAlign
} from '../knowledge-graph-extraction.embed-refresh'

function personNode(summary: string): NotebookGraphNodeRawRecord {
  return {
    id: 'n1',
    schemaVersion: 1,
    vaultId: 'vlt_aaaaaaaaaaaaaaaa',
    vaultName: 'Personal',
    notebookId: 'nb-this',
    nodeType: 'person',
    name: '张三',
    aliases: ['三哥'],
    summary,
    props: {},
    mentionCount: 1,
    firstSeenAt: 1,
    lastSeenAt: 1,
    origin: 'ai',
    shardMonth: 'src1',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    reviewStatus: 'approved'
  }
}

describe('notebookGraphCardChanged', () => {
  it('should return false when there is no prior row', () => {
    expect(notebookGraphCardChanged(null, { name: '张三', summary: '同事' })).toBe(false)
  })

  it('should return false when name and summary stay the same', () => {
    expect(
      notebookGraphCardChanged({ name: '张三', summary: '同事' }, { name: '张三', summary: '同事' })
    ).toBe(false)
  })

  it('should return true when the summary changes the card', () => {
    expect(
      notebookGraphCardChanged(
        { name: '张三', summary: '同事' },
        { name: '张三', summary: '大学同学' }
      )
    ).toBe(true)
  })
})

describe('refreshNotebookEmbeddingsAfterAlign', () => {
  it('should queue embedQuery when stored summary differs from the new card', async () => {
    const pendingEmbeddings = new Map<string, number[]>()
    const embedQuery = vi.fn(async () => [0, 1])
    const clearNodeEmbedding = vi.fn(async () => undefined)
    await refreshNotebookEmbeddingsAfterAlign(
      {
        repo: {
          findNodesByNameOrAlias: async () => [{ id: 'n1', name: '张三', summary: '同事' }],
          clearNodeEmbedding
        },
        align: { embedQuery }
      },
      {
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        notebookId: 'nb-this',
        nodes: [personNode('大学同学')],
        pendingEmbeddings
      }
    )
    expect(embedQuery).toHaveBeenCalledWith(graphNodeCardText('张三', '大学同学'))
    expect(pendingEmbeddings.get('n1')).toEqual([0, 1])
    expect(clearNodeEmbedding).not.toHaveBeenCalled()
  })

  it('should skip embedQuery when the card stays the same', async () => {
    const pendingEmbeddings = new Map<string, number[]>()
    const embedQuery = vi.fn(async () => [0, 1])
    await refreshNotebookEmbeddingsAfterAlign(
      {
        repo: {
          findNodesByNameOrAlias: async () => [{ id: 'n1', name: '张三', summary: '同事' }]
        },
        align: { embedQuery }
      },
      {
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        notebookId: 'nb-this',
        nodes: [personNode('同事')],
        pendingEmbeddings
      }
    )
    expect(embedQuery).not.toHaveBeenCalled()
    expect(pendingEmbeddings.size).toBe(0)
  })

  it('should skip embedQuery when pending already has a vector for the node', async () => {
    const pendingEmbeddings = new Map<string, number[]>([['n1', [9, 9]]])
    const embedQuery = vi.fn(async () => [0, 1])
    await refreshNotebookEmbeddingsAfterAlign(
      {
        repo: {
          findNodesByNameOrAlias: async () => [{ id: 'n1', name: '张三', summary: '同事' }]
        },
        align: { embedQuery }
      },
      {
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        notebookId: 'nb-this',
        nodes: [personNode('大学同学')],
        pendingEmbeddings
      }
    )
    expect(embedQuery).not.toHaveBeenCalled()
    expect(pendingEmbeddings.get('n1')).toEqual([9, 9])
  })

  it('should rethrow embedQuery errors when requireEmbed is set', async () => {
    const embedQuery = vi.fn(async () => {
      throw new Error('Payment Required')
    })
    await expect(
      refreshNotebookEmbeddingsAfterAlign(
        {
          repo: {
            findNodesByNameOrAlias: async () => [{ id: 'n1', name: '张三', summary: '同事' }]
          },
          align: { embedQuery }
        },
        {
          vaultId: 'vlt_aaaaaaaaaaaaaaaa',
          notebookId: 'nb-this',
          nodes: [personNode('大学同学')],
          pendingEmbeddings: new Map()
        },
        { requireEmbed: true }
      )
    ).rejects.toThrow('Payment Required')
  })

  it('should clear the old embedding when embedQuery fails', async () => {
    const pendingEmbeddings = new Map<string, number[]>()
    const embedQuery = vi.fn(async () => {
      throw new Error('embed down')
    })
    const clearNodeEmbedding = vi.fn(async () => undefined)
    await refreshNotebookEmbeddingsAfterAlign(
      {
        repo: {
          findNodesByNameOrAlias: async () => [{ id: 'n1', name: '张三', summary: '同事' }],
          clearNodeEmbedding
        },
        align: { embedQuery }
      },
      {
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        notebookId: 'nb-this',
        nodes: [personNode('大学同学')],
        pendingEmbeddings
      }
    )
    expect(pendingEmbeddings.size).toBe(0)
    expect(clearNodeEmbedding).toHaveBeenCalledWith('n1', 'vlt_aaaaaaaaaaaaaaaa', 'nb-this')
  })

  it('should keep repository this when clearing the old embedding', async () => {
    const cleared: unknown[][] = []
    class RepoLike {
      embed = {
        clearNodeEmbedding: async (...args: unknown[]) => {
          cleared.push(args)
        }
      }
      findNodesByNameOrAlias = async () => [{ id: 'n1', name: '张三', summary: '同事' }]
      clearNodeEmbedding(id: string, vaultId: string, notebookId: string) {
        return this.embed.clearNodeEmbedding(id, vaultId, notebookId)
      }
    }
    const embedQuery = vi.fn(async () => {
      throw new Error('embed down')
    })
    await refreshNotebookEmbeddingsAfterAlign(
      { repo: new RepoLike(), align: { embedQuery } },
      {
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        notebookId: 'nb-this',
        nodes: [personNode('大学同学')],
        pendingEmbeddings: new Map()
      }
    )
    expect(cleared).toEqual([['n1', 'vlt_aaaaaaaaaaaaaaaa', 'nb-this']])
  })
})
