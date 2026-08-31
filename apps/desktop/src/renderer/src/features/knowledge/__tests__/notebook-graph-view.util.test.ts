import { describe, expect, it } from 'vitest'
import {
  remapNotebookGraphReviewForDisplay,
  splitNotebookGraphPending
} from '../notebook-graph-view.util'

describe('splitNotebookGraphPending', () => {
  it('keeps only pending nodes and edges', () => {
    const split = splitNotebookGraphPending(
      [
        { id: 'n1', name: '甲', nodeType: 'person', reviewStatus: 'pending' },
        { id: 'n2', name: '乙', nodeType: 'person', reviewStatus: 'approved' }
      ],
      [
        { id: 'e1', fromId: 'n1', toId: 'n2', edgeType: 'knows', reviewStatus: 'pending' },
        { id: 'e2', fromId: 'n2', toId: 'n1', edgeType: 'knows', reviewStatus: 'approved' }
      ]
    )
    expect(split.pendingNodes.map((row) => row.id)).toEqual(['n1'])
    expect(split.pendingEdges.map((row) => row.id)).toEqual(['e1'])
  })

  it('remaps pending leftovers from 0-1 confidence as approved', () => {
    const remapped = remapNotebookGraphReviewForDisplay(
      [{ id: 'n1', name: '景别', nodeType: 'topic', reviewStatus: 'pending' }],
      [
        {
          id: 'e1',
          fromId: 'n1',
          toId: 'n2',
          edgeType: 'relates_to',
          reviewStatus: 'pending',
          confidence: 1
        }
      ]
    )
    expect(remapped.nodes[0]?.reviewStatus).toBe('approved')
    expect(remapped.edges[0]?.reviewStatus).toBe('approved')
  })

  it('keeps real low 0-100 confidence pending', () => {
    const remapped = remapNotebookGraphReviewForDisplay(
      [{ id: 'n1', name: '甲', nodeType: 'person', reviewStatus: 'pending' }],
      [
        {
          id: 'e1',
          fromId: 'n1',
          toId: 'n2',
          edgeType: 'relates_to',
          reviewStatus: 'pending',
          confidence: 42
        }
      ]
    )
    expect(remapped.nodes[0]?.reviewStatus).toBe('pending')
    expect(remapped.edges[0]?.reviewStatus).toBe('pending')
  })
})
