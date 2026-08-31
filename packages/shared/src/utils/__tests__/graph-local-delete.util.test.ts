import { describe, expect, it } from 'vitest'
import { graphPendingItemKey } from '../graph-review-batch.util'
import {
  applyGraphLocalEdgeDelete,
  applyGraphLocalNodeDelete,
  omitInFlightGraphDeletes,
  restoreGraphLocalEdgeDelete,
  restoreGraphLocalNodeDelete
} from '../graph-local-delete.util'

describe('applyGraphLocalNodeDelete', () => {
  it('drops the node, incident edges, and related chrome without touching other rows', () => {
    const next = applyGraphLocalNodeDelete({
      nodeId: 'n1',
      nodes: [{ id: 'n1' }, { id: 'n2' }],
      edges: [
        { id: 'e1', fromId: 'n1', toId: 'n2' },
        { id: 'e2', fromId: 'n2', toId: 'n3' }
      ],
      pendingNodes: [{ id: 'n1' }, { id: 'n4' }],
      pendingEdges: [
        { id: 'e1', fromId: 'n1', toId: 'n2' },
        { id: 'e3', fromId: 'n4', toId: 'n5' }
      ],
      pendingSelected: new Set([
        graphPendingItemKey('node', 'n1'),
        graphPendingItemKey('edge', 'e1'),
        graphPendingItemKey('node', 'n4')
      ]),
      highlightIds: new Set(['n1', 'n2']),
      highlightedEdgeIds: new Set(['e1', 'e2']),
      locateIds: ['n1', 'n2'],
      localView: {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [{ id: 'e1', fromId: 'n1', toId: 'n2' }]
      }
    })

    expect(next.nodes.map((node) => node.id)).toEqual(['n2'])
    expect(next.edges.map((edge) => edge.id)).toEqual(['e2'])
    expect(next.pendingNodes.map((node) => node.id)).toEqual(['n4'])
    expect(next.pendingEdges.map((edge) => edge.id)).toEqual(['e3'])
    expect([...next.pendingSelected]).toEqual([graphPendingItemKey('node', 'n4')])
    expect([...next.highlightIds]).toEqual(['n2'])
    expect([...next.highlightedEdgeIds]).toEqual(['e2'])
    expect(next.locateIds).toEqual(['n2'])
    expect(next.localView?.nodes.map((node) => node.id)).toEqual(['n2'])
    expect(next.localView?.edges).toEqual([])
  })
})

describe('applyGraphLocalEdgeDelete', () => {
  it('drops only that edge from the lists', () => {
    const next = applyGraphLocalEdgeDelete({
      edgeId: 'e1',
      edges: [
        { id: 'e1', fromId: 'n1', toId: 'n2' },
        { id: 'e2', fromId: 'n2', toId: 'n3' }
      ],
      pendingEdges: [{ id: 'e1', fromId: 'n1', toId: 'n2' }],
      pendingSelected: new Set([graphPendingItemKey('edge', 'e1'), graphPendingItemKey('node', 'n1')]),
      highlightedEdgeIds: new Set(['e1', 'e2']),
      localView: {
        nodes: [{ id: 'n1' }],
        edges: [{ id: 'e1', fromId: 'n1', toId: 'n2' }]
      }
    })

    expect(next.edges.map((edge) => edge.id)).toEqual(['e2'])
    expect(next.pendingEdges).toEqual([])
    expect([...next.pendingSelected]).toEqual([graphPendingItemKey('node', 'n1')])
    expect([...next.highlightedEdgeIds]).toEqual(['e2'])
    expect(next.localView?.edges).toEqual([])
    expect(next.localView?.nodes).toEqual([{ id: 'n1' }])
  })
})

describe('omitInFlightGraphDeletes', () => {
  it('drops in-flight nodes and touching edges from a later refresh payload', () => {
    const next = omitInFlightGraphDeletes({
      nodes: [{ id: 'n1' }, { id: 'n2' }],
      edges: [
        { id: 'e1', fromId: 'n1', toId: 'n2' },
        { id: 'e2', fromId: 'n2', toId: 'n3' }
      ],
      pendingNodes: [{ id: 'n1' }],
      pendingEdges: [{ id: 'e3', fromId: 'n2', toId: 'n4' }],
      deletedNodeIds: new Set(['n1']),
      deletedEdgeIds: new Set(['e3'])
    })
    expect(next.nodes.map((node) => node.id)).toEqual(['n2'])
    expect(next.edges.map((edge) => edge.id)).toEqual(['e2'])
    expect(next.pendingNodes).toEqual([])
    expect(next.pendingEdges).toEqual([])
  })
})

describe('restoreGraphLocalNodeDelete', () => {
  it('puts only the failed node back and keeps later rows', () => {
    const next = restoreGraphLocalNodeDelete({
      nodeId: 'n1',
      current: {
        nodes: [{ id: 'n2' }, { id: 'n3' }],
        edges: [{ id: 'e2', fromId: 'n2', toId: 'n3' }],
        pendingNodes: [],
        pendingEdges: [],
        localView: { nodes: [{ id: 'n2' }], edges: [] }
      },
      before: {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          { id: 'e1', fromId: 'n1', toId: 'n2' },
          { id: 'e2', fromId: 'n2', toId: 'n3' }
        ],
        pendingNodes: [{ id: 'n1' }],
        pendingEdges: [{ id: 'e1', fromId: 'n1', toId: 'n2' }],
        localView: {
          nodes: [{ id: 'n1' }, { id: 'n2' }],
          edges: [{ id: 'e1', fromId: 'n1', toId: 'n2' }]
        }
      }
    })
    expect(next.nodes.map((node) => node.id)).toEqual(['n2', 'n3', 'n1'])
    expect(next.edges.map((edge) => edge.id)).toEqual(['e2', 'e1'])
    expect(next.pendingNodes.map((node) => node.id)).toEqual(['n1'])
    expect(next.localView?.nodes.map((node) => node.id)).toEqual(['n2', 'n1'])
  })
})

describe('restoreGraphLocalEdgeDelete', () => {
  it('puts only the failed edge back', () => {
    const next = restoreGraphLocalEdgeDelete({
      edgeId: 'e1',
      current: {
        edges: [{ id: 'e2', fromId: 'n2', toId: 'n3' }],
        pendingEdges: [],
        localView: { nodes: [{ id: 'n1' }], edges: [] }
      },
      before: {
        edges: [{ id: 'e1', fromId: 'n1', toId: 'n2' }],
        pendingEdges: [{ id: 'e1', fromId: 'n1', toId: 'n2' }],
        localView: { nodes: [{ id: 'n1' }], edges: [{ id: 'e1', fromId: 'n1', toId: 'n2' }] }
      }
    })
    expect(next.edges.map((edge) => edge.id)).toEqual(['e2', 'e1'])
    expect(next.pendingEdges.map((edge) => edge.id)).toEqual(['e1'])
    expect(next.localView?.edges.map((edge) => edge.id)).toEqual(['e1'])
  })
})
