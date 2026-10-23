import { afterEach, describe, expect, it, vi } from 'vitest'
import * as mergeNodes from '../graph-merge-nodes'
import { revertGraphNodeSplit } from '../graph-split-node'
import {
  createLiveGraph,
  expectedSplitId,
  makeBareNode,
  makeEdge
} from './graph-split-node.test-helpers'

describe('revertGraphNodeSplit', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should call merge and remove the registry from post-merge props when reverting', async () => {
    const mergeSpy = vi.spyOn(mergeNodes, 'mergeDiaryGraphNodes')
    const splitId = expectedSplitId
    const { manager, repo, writes } = createLiveGraph({
      nodes: [
        makeBareNode({
          propsJson: JSON.stringify({
            keepMe: 'must-survive-merge',
            nameRegistry: [
              {
                discriminator: '同事',
                label: '公司同事',
                nodeId: splitId,
                registeredAt: 50
              }
            ]
          })
        }),
        {
          id: splitId,
          vaultId: 'v1',
          nodeType: 'person',
          name: '张三',
          aliases: ['张三'],
          summary: '公司里的张三',
          propsJson: '{}',
          mentionCount: 0,
          firstSeenAt: 100,
          lastSeenAt: 100,
          origin: 'user',
          shardMonth: '2026-01',
          reviewStatus: 'approved',
          createdAt: 100,
          discriminator: '同事'
        }
      ],
      edges: [makeEdge({ id: 'e-moved', fromId: splitId, toId: 'place-1' })]
    })

    const result = await revertGraphNodeSplit({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      reason: 'undo-split',
      now: 200,
      manager: manager as never,
      repo: repo as never
    })

    expect(result).toEqual({ removedNodeId: splitId })
    expect(mergeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        survivorId: 'bare-1',
        loserId: splitId,
        reason: 'undo-split',
        now: 200
      })
    )

    const lastBareWrite = [...writes]
      .reverse()
      .find((item) => item.collection === 'nodes' && item.record.id === 'bare-1')
    const props = lastBareWrite?.record.props as Record<string, unknown> | undefined
    expect(props?.nameRegistry).toBeUndefined()
    expect(props?.keepMe).toBe('must-survive-merge')
    expect(Array.isArray(props?.mergeHistory)).toBe(true)
    expect(props?.mergeHistory).toEqual(
      expect.arrayContaining([expect.objectContaining({ loserId: splitId, reason: 'undo-split' })])
    )

    mergeSpy.mockRestore()
  })

  it('should remove the registry without merging when the split node is already gone', async () => {
    const mergeSpy = vi.spyOn(mergeNodes, 'mergeDiaryGraphNodes')
    const { manager, repo, writes } = createLiveGraph({
      nodes: [
        makeBareNode({
          propsJson: JSON.stringify({
            keepMe: 'must-survive-clear',
            nameRegistry: [
              {
                discriminator: '同事',
                label: '公司同事',
                nodeId: expectedSplitId,
                registeredAt: 50
              }
            ]
          })
        })
      ],
      edges: []
    })

    const result = await revertGraphNodeSplit({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      now: 200,
      manager: manager as never,
      repo: repo as never
    })

    expect(result).toEqual({ removedNodeId: null })
    expect(mergeSpy).not.toHaveBeenCalled()
    const lastBareWrite = [...writes]
      .reverse()
      .find((item) => item.collection === 'nodes' && item.record.id === 'bare-1')
    const props = lastBareWrite?.record.props as Record<string, unknown> | undefined
    expect(props?.nameRegistry).toBeUndefined()
    expect(props?.keepMe).toBe('must-survive-clear')
    mergeSpy.mockRestore()
  })

  it('should pass revert-split to merge when revert reason is omitted', async () => {
    const mergeSpy = vi.spyOn(mergeNodes, 'mergeDiaryGraphNodes')
    const splitId = expectedSplitId
    const { manager, repo } = createLiveGraph({
      nodes: [
        makeBareNode({
          propsJson: JSON.stringify({
            nameRegistry: [
              {
                discriminator: '同事',
                label: '公司同事',
                nodeId: splitId,
                registeredAt: 50
              }
            ]
          })
        }),
        {
          id: splitId,
          vaultId: 'v1',
          nodeType: 'person',
          name: '张三',
          aliases: ['张三'],
          summary: '',
          propsJson: '{}',
          mentionCount: 0,
          firstSeenAt: 100,
          lastSeenAt: 100,
          origin: 'user',
          shardMonth: '2026-01',
          reviewStatus: 'approved',
          createdAt: 100,
          discriminator: '同事'
        }
      ],
      edges: []
    })

    await revertGraphNodeSplit({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      now: 200,
      manager: manager as never,
      repo: repo as never
    })

    expect(mergeSpy).toHaveBeenCalledWith(expect.objectContaining({ reason: 'revert-split' }))
    mergeSpy.mockRestore()
  })

  it('should return null when the discriminator is not registered', async () => {
    const mergeSpy = vi.spyOn(mergeNodes, 'mergeDiaryGraphNodes')
    const { manager, repo } = createLiveGraph({
      nodes: [makeBareNode({ propsJson: '{}' })],
      edges: []
    })

    const result = await revertGraphNodeSplit({
      vaultId: 'v1',
      vaultName: 'Personal',
      bareNodeId: 'bare-1',
      discriminator: '同事',
      manager: manager as never,
      repo: repo as never
    })

    expect(result).toEqual({ removedNodeId: null })
    expect(mergeSpy).not.toHaveBeenCalled()
    mergeSpy.mockRestore()
  })
})
