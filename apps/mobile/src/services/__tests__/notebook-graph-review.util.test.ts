import { describe, expect, it } from 'vitest'
import {
  applyNotebookGraphLocalReview,
  applyNotebookGraphLocalReviewBatch,
  notebookGraphNodeReviewNeedsNeighborhood
} from '../notebook-graph-review.util'

describe('applyNotebookGraphLocalReviewBatch', () => {
  const nodes = () => [
    { id: 'a', reviewStatus: 'pending' },
    { id: 'b', reviewStatus: 'pending' },
    { id: 'c', reviewStatus: 'pending' },
    { id: 'd', reviewStatus: 'approved' }
  ]
  const edges = () => [
    { id: 'e1', fromId: 'a', toId: 'b', reviewStatus: 'pending' },
    { id: 'e2', fromId: 'c', toId: 'd', reviewStatus: 'pending' },
    { id: 'e3', fromId: 'a', toId: 'c', reviewStatus: 'rejected' }
  ]

  it('approves selected nodes, their pending edges and the pending endpoints of those edges', () => {
    const out = applyNotebookGraphLocalReviewBatch({
      nodes: nodes(),
      edges: edges(),
      nodeIds: ['a'],
      edgeIds: [],
      status: 'approved'
    })
    expect(out.nodes.map((n) => [n.id, n.reviewStatus])).toEqual([
      ['a', 'approved'],
      ['b', 'approved'],
      ['c', 'pending'],
      ['d', 'approved']
    ])
    expect(out.edges.map((e) => [e.id, e.reviewStatus])).toEqual([
      ['e1', 'approved'],
      ['e2', 'pending'],
      ['e3', 'rejected']
    ])
  })

  it('rejects touching edges of rejected nodes without touching their endpoints', () => {
    const out = applyNotebookGraphLocalReviewBatch({
      nodes: nodes(),
      edges: edges(),
      nodeIds: ['a'],
      edgeIds: [],
      status: 'rejected'
    })
    expect(out.nodes.map((n) => [n.id, n.reviewStatus])).toEqual([
      ['a', 'rejected'],
      ['b', 'pending'],
      ['c', 'pending'],
      ['d', 'approved']
    ])
    expect(out.edges.map((e) => [e.id, e.reviewStatus])).toEqual([
      ['e1', 'rejected'],
      ['e2', 'pending'],
      ['e3', 'rejected']
    ])
  })

  it('approving a selected edge approves only its pending endpoints', () => {
    const out = applyNotebookGraphLocalReviewBatch({
      nodes: nodes(),
      edges: edges(),
      nodeIds: [],
      edgeIds: ['e2'],
      status: 'approved'
    })
    expect(out.nodes.map((n) => [n.id, n.reviewStatus])).toEqual([
      ['a', 'pending'],
      ['b', 'pending'],
      ['c', 'approved'],
      ['d', 'approved']
    ])
    expect(out.edges.map((e) => [e.id, e.reviewStatus])).toEqual([
      ['e1', 'pending'],
      ['e2', 'approved'],
      ['e3', 'rejected']
    ])
  })

  it('does not mutate the input arrays', () => {
    const input = nodes()
    applyNotebookGraphLocalReviewBatch({
      nodes: input,
      edges: edges(),
      nodeIds: ['a'],
      edgeIds: [],
      status: 'approved'
    })
    expect(input[0]?.reviewStatus).toBe('pending')
  })
})

describe('notebookGraphNodeReviewNeedsNeighborhood', () => {
  it('should skip neighborhood when approving a node that already has a shard', () => {
    expect(
      notebookGraphNodeReviewNeedsNeighborhood({
        reviewStatus: 'approved',
        shardMonth: 'src-1',
        sourceId: ''
      })
    ).toBe(false)
  })

  it('should load neighborhood when rejecting a node or the shard is missing', () => {
    expect(
      notebookGraphNodeReviewNeedsNeighborhood({
        reviewStatus: 'rejected',
        shardMonth: 'src-1'
      })
    ).toBe(true)
    expect(
      notebookGraphNodeReviewNeedsNeighborhood({
        reviewStatus: 'approved',
        shardMonth: '',
        sourceId: ''
      })
    ).toBe(true)
  })
})

describe('applyNotebookGraphLocalReview', () => {
  const nodes = [
    { id: 'a', reviewStatus: 'pending' },
    { id: 'b', reviewStatus: 'pending' },
    { id: 'c', reviewStatus: 'approved' }
  ]
  const edges = [
    { id: 'e1', fromId: 'a', toId: 'b', reviewStatus: 'pending' },
    { id: 'e2', fromId: 'b', toId: 'c', reviewStatus: 'pending' }
  ]

  it('should approve a relation and its pending endpoints without waiting for a reload', () => {
    const next = applyNotebookGraphLocalReview({
      nodes,
      edges,
      kind: 'edge',
      id: 'e1',
      status: 'approved'
    })
    expect(next.edges.find((edge) => edge.id === 'e1')?.reviewStatus).toBe('approved')
    expect(next.nodes.find((node) => node.id === 'a')?.reviewStatus).toBe('approved')
    expect(next.nodes.find((node) => node.id === 'b')?.reviewStatus).toBe('approved')
    expect(next.edges.find((edge) => edge.id === 'e2')?.reviewStatus).toBe('pending')
  })

  it('should reject only the relation when the user rejects an edge', () => {
    const next = applyNotebookGraphLocalReview({
      nodes,
      edges,
      kind: 'edge',
      id: 'e1',
      status: 'rejected'
    })
    expect(next.edges.find((edge) => edge.id === 'e1')?.reviewStatus).toBe('rejected')
    expect(next.nodes.find((node) => node.id === 'a')?.reviewStatus).toBe('pending')
  })
})
