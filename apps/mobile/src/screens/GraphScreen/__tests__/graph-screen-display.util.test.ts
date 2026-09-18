import { describe, expect, it } from 'vitest'
import {
  GRAPH_FILTER_NODE_TYPES,
  buildGraphScreenDetailEdges,
  buildGraphScreenDisplayEdges,
  buildGraphScreenDisplayNodes,
  countGraphCanvasNodes,
  filterGraphScreenDisplayNode,
  isGraphCanvasFilterActive,
  isGraphTypeFilterActive,
  toggleGraphNodeTypeFilter
} from '../graph-screen-display.util'
import type { GraphScreenEdge, GraphScreenNode } from '../graph-screen.types'

const emptyHighlight = {
  highlightIds: new Set<string>(),
  highlightedEdgeIds: new Set<string>(),
  selectedId: null as string | null,
  hideEntry: true,
  approvedOnly: false,
  enabledNodeTypes: new Set(GRAPH_FILTER_NODE_TYPES)
}

function node(partial: Partial<GraphScreenNode> & Pick<GraphScreenNode, 'id'>): GraphScreenNode {
  return { nodeType: 'person', reviewStatus: 'approved', ...partial }
}

function edge(
  partial: Partial<GraphScreenEdge> & Pick<GraphScreenEdge, 'id' | 'fromId' | 'toId'>
): GraphScreenEdge {
  return { reviewStatus: 'approved', ...partial }
}

describe('GRAPH_FILTER_NODE_TYPES', () => {
  it('should exclude the structural diary entry type when building filter chips', () => {
    expect(GRAPH_FILTER_NODE_TYPES).not.toContain('entry')
    expect(GRAPH_FILTER_NODE_TYPES).toContain('person')
  })
})

describe('filter flags', () => {
  it('should treat a full type set as inactive and a missing type as active', () => {
    expect(isGraphTypeFilterActive(new Set(GRAPH_FILTER_NODE_TYPES))).toBe(false)
    expect(isGraphTypeFilterActive(new Set(['person']))).toBe(true)
  })

  it('should mark the canvas filter active when hideEntry is off or approved-only is on', () => {
    expect(
      isGraphCanvasFilterActive({
        hideEntry: true,
        approvedOnly: false,
        enabledNodeTypes: new Set(GRAPH_FILTER_NODE_TYPES)
      })
    ).toBe(false)
    expect(
      isGraphCanvasFilterActive({
        hideEntry: false,
        approvedOnly: false,
        enabledNodeTypes: new Set(GRAPH_FILTER_NODE_TYPES)
      })
    ).toBe(true)
    expect(
      isGraphCanvasFilterActive({
        hideEntry: true,
        approvedOnly: true,
        enabledNodeTypes: new Set(GRAPH_FILTER_NODE_TYPES)
      })
    ).toBe(true)
  })

  it('should add and remove a type from the enabled set', () => {
    const next = toggleGraphNodeTypeFilter(new Set(['person']), 'person')
    expect(next.has('person')).toBe(false)
    expect(toggleGraphNodeTypeFilter(next, 'person').has('person')).toBe(true)
  })
})

describe('filterGraphScreenDisplayNode', () => {
  it('should drop rejected nodes and hidden diary anchors', () => {
    expect(
      filterGraphScreenDisplayNode(node({ id: 'r', reviewStatus: 'rejected' }), emptyHighlight)
    ).toBe(false)
    expect(filterGraphScreenDisplayNode(node({ id: 'e', nodeType: 'entry' }), emptyHighlight)).toBe(
      false
    )
    expect(
      filterGraphScreenDisplayNode(node({ id: 'e', nodeType: 'entry' }), {
        ...emptyHighlight,
        hideEntry: false
      })
    ).toBe(true)
  })

  it('should keep a located diary anchor even when hideEntry is on', () => {
    expect(
      filterGraphScreenDisplayNode(node({ id: 'e', nodeType: 'entry' }), {
        ...emptyHighlight,
        highlightIds: new Set(['e']),
        highlightedEdgeIds: new Set(['edge-1'])
      })
    ).toBe(true)
  })

  it('should drop pending nodes in approved-only mode unless selected or located', () => {
    const pending = node({ id: 'p', reviewStatus: 'pending' })
    expect(filterGraphScreenDisplayNode(pending, { ...emptyHighlight, approvedOnly: true })).toBe(
      false
    )
    expect(
      filterGraphScreenDisplayNode(pending, {
        ...emptyHighlight,
        approvedOnly: true,
        selectedId: 'p',
        keepPendingSelected: true
      })
    ).toBe(true)
  })

  it('should hide disabled entity types except when the node is located', () => {
    const place = node({ id: 'pl', nodeType: 'place' })
    expect(
      filterGraphScreenDisplayNode(place, {
        ...emptyHighlight,
        enabledNodeTypes: new Set(['person'])
      })
    ).toBe(false)
    expect(
      filterGraphScreenDisplayNode(place, {
        ...emptyHighlight,
        enabledNodeTypes: new Set(['person']),
        highlightIds: new Set(['pl']),
        highlightedEdgeIds: new Set(['e1'])
      })
    ).toBe(true)
  })
})

describe('buildGraphScreenDisplayNodes', () => {
  it('should use the neighborhood subgraph when it is pinned', () => {
    const result = buildGraphScreenDisplayNodes({
      nodes: [node({ id: 'global' })],
      hideEntry: true,
      approvedOnly: false,
      enabledNodeTypes: new Set(GRAPH_FILTER_NODE_TYPES),
      localView: { nodes: [node({ id: 'local' })], edges: [] },
      selectedId: 'local',
      selectedNode: node({ id: 'local' }),
      pinNeighborhood: true,
      highlightIds: new Set(),
      highlightedEdgeIds: new Set()
    })
    expect(result.map((n) => n.id)).toEqual(['local'])
  })

  it('should splice in the selected node when it is missing from the month slice', () => {
    const selected = node({ id: 'outside' })
    const result = buildGraphScreenDisplayNodes({
      nodes: [node({ id: 'in-range' })],
      hideEntry: true,
      approvedOnly: false,
      enabledNodeTypes: new Set(GRAPH_FILTER_NODE_TYPES),
      localView: { nodes: [selected], edges: [] },
      selectedId: 'outside',
      selectedNode: selected,
      pinNeighborhood: false,
      highlightIds: new Set(),
      highlightedEdgeIds: new Set()
    })
    expect(result.map((n) => n.id).sort()).toEqual(['in-range', 'outside'])
  })
})

describe('buildGraphScreenDisplayEdges', () => {
  it('should keep pending edges while a neighborhood is pinned and drop them in approved-only global view', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b' })]
    const pending = edge({ id: 'e1', fromId: 'a', toId: 'b', reviewStatus: 'pending' })
    expect(
      buildGraphScreenDisplayEdges({
        displayNodes: nodes,
        edges: [],
        approvedOnly: true,
        localView: { nodes, edges: [pending] },
        selectedId: 'a',
        nodes,
        pinNeighborhood: true
      }).map((e) => e.id)
    ).toEqual(['e1'])
    expect(
      buildGraphScreenDisplayEdges({
        displayNodes: nodes,
        edges: [pending],
        approvedOnly: true,
        localView: null,
        selectedId: null,
        nodes,
        pinNeighborhood: false
      })
    ).toEqual([])
  })

  it('should merge local-view edges when the selected node is outside the month slice', () => {
    const display = [node({ id: 'a' }), node({ id: 'b' })]
    const extra = edge({ id: 'extra', fromId: 'a', toId: 'b' })
    expect(
      buildGraphScreenDisplayEdges({
        displayNodes: display,
        edges: [],
        approvedOnly: false,
        localView: { nodes: display, edges: [extra] },
        selectedId: 'missing',
        nodes: [node({ id: 'other' })],
        pinNeighborhood: false
      }).map((e) => e.id)
    ).toEqual(['extra'])
  })

  it('should drop rejected edges and duplicates', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b' })]
    const keep = edge({ id: 'keep', fromId: 'a', toId: 'b' })
    expect(
      buildGraphScreenDisplayEdges({
        displayNodes: nodes,
        edges: [keep, keep, edge({ id: 'rej', fromId: 'a', toId: 'b', reviewStatus: 'rejected' })],
        approvedOnly: false,
        localView: null,
        selectedId: null,
        nodes,
        pinNeighborhood: false
      }).map((e) => e.id)
    ).toEqual(['keep'])
  })
})

describe('buildGraphScreenDetailEdges', () => {
  it('should list incident edges and skip rejected ones', () => {
    const edges = [
      edge({ id: 'out', fromId: 'n1', toId: 'n2' }),
      edge({ id: 'in', fromId: 'n3', toId: 'n1' }),
      edge({ id: 'rej', fromId: 'n1', toId: 'n4', reviewStatus: 'rejected' }),
      edge({ id: 'other', fromId: 'n2', toId: 'n3' })
    ]
    const list = buildGraphScreenDetailEdges({
      selectedId: 'n1',
      localView: null,
      edges,
      resolvePartnerName: (id) => `name:${id}`
    })
    expect(list.map((row) => [row.edge.id, row.partnerName])).toEqual([
      ['out', 'name:n2'],
      ['in', 'name:n3']
    ])
  })

  it('should prefer local-view edges and return empty without a selection', () => {
    expect(
      buildGraphScreenDetailEdges({
        selectedId: 'n1',
        localView: { edges: [edge({ id: 'local', fromId: 'n1', toId: 'x' })] },
        edges: [edge({ id: 'global', fromId: 'n1', toId: 'y' })],
        resolvePartnerName: (id) => id
      }).map((row) => row.edge.id)
    ).toEqual(['local'])
    expect(
      buildGraphScreenDetailEdges({
        selectedId: null,
        localView: null,
        edges: [edge({ id: 'e', fromId: 'a', toId: 'b' })],
        resolvePartnerName: (id) => id
      })
    ).toEqual([])
  })
})

describe('countGraphCanvasNodes', () => {
  it('should ignore rejected nodes when counting the canvas', () => {
    expect(
      countGraphCanvasNodes([
        { reviewStatus: 'approved' },
        { reviewStatus: 'pending' },
        { reviewStatus: 'rejected' }
      ])
    ).toBe(2)
  })
})
