import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import {
  buildGraphNodeNameMap,
  collectGraphFocusIds,
  resolveGraphNodeDisplayName
} from '@baishou/shared'
import {
  buildGraphScreenDetailEdges,
  buildGraphScreenDisplayEdges,
  buildGraphScreenDisplayNodes
} from './graph-screen-display.util'

type GraphScreenDisplayModelOptions = {
  graphNodes: any[]
  graphEdges: any[]
  pendingNodes: any[]
  pendingEndpointNodes: any[]
  localView: any
  selectedId: string | null
  selectedNode: any
  pinNeighborhood: any
  focusDepth: number
  highlightIds: any
  highlightedEdgeIds: any
  hideEntry: boolean
  approvedOnly: boolean
  enabledNodeTypes: any
  t: TFunction
}

/**
 * 图谱画布展示派生：可见节点/边、聚焦集合、节点名称映射与详情关系。
 * 只做纯派生，不持有额外状态。
 */
export function useGraphScreenDisplayModel(opts: GraphScreenDisplayModelOptions) {
  const {
    graphNodes,
    graphEdges,
    pendingNodes,
    pendingEndpointNodes,
    localView,
    selectedId,
    selectedNode,
    pinNeighborhood,
    focusDepth,
    highlightIds,
    highlightedEdgeIds,
    hideEntry,
    approvedOnly,
    enabledNodeTypes,
    t
  } = opts

  const displayNodes = useMemo(
    () =>
      buildGraphScreenDisplayNodes({
        nodes: graphNodes,
        hideEntry,
        approvedOnly,
        enabledNodeTypes,
        localView,
        selectedId,
        selectedNode,
        pinNeighborhood,
        highlightIds,
        highlightedEdgeIds
      }),
    [
      graphNodes,
      hideEntry,
      approvedOnly,
      enabledNodeTypes,
      localView,
      selectedId,
      selectedNode,
      pinNeighborhood,
      highlightIds,
      highlightedEdgeIds
    ]
  )
  const displayEdges = useMemo(
    () =>
      buildGraphScreenDisplayEdges({
        displayNodes,
        edges: graphEdges,
        approvedOnly,
        localView,
        selectedId,
        nodes: graphNodes,
        pinNeighborhood
      }),
    [displayNodes, graphEdges, approvedOnly, localView, selectedId, graphNodes, pinNeighborhood]
  )
  const focusIds = useMemo(() => {
    if (!selectedId) return undefined
    return collectGraphFocusIds(selectedId, displayEdges, focusDepth)
  }, [selectedId, displayEdges, focusDepth])
  const graphNodeNameById = useMemo(
    () =>
      buildGraphNodeNameMap([
        ...graphNodes,
        ...pendingNodes,
        ...pendingEndpointNodes,
        ...(localView?.nodes || [])
      ]),
    [graphNodes, pendingNodes, pendingEndpointNodes, localView]
  )
  const detailEdges = useMemo(
    () =>
      buildGraphScreenDetailEdges({
        selectedId,
        localView,
        edges: graphEdges,
        resolvePartnerName: (partnerId) =>
          resolveGraphNodeDisplayName(
            graphNodeNameById,
            partnerId,
            t('graph.unknown_node', '未知节点')
          )
      }),
    [localView, selectedId, graphEdges, graphNodeNameById, t]
  )

  return { displayNodes, displayEdges, focusIds, graphNodeNameById, detailEdges }
}
