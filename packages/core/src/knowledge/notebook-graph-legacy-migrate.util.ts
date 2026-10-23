import type {
  NotebookGraphEdgeRawRecord,
  NotebookGraphExtractStateRawRecord,
  NotebookGraphNodeRawRecord
} from '@baishou/shared'
import {
  NOTEBOOK_GRAPH_LEGACY_SHARD_KEY,
  isPresentNotebookGraphShardKey,
  notebookGraphSourceIdFromSourceRef
} from '../raw-data/notebook-graph-shard-key.util'

export function resolveNotebookGraphShardKey(record: {
  shardMonth?: string
  sourceId?: string
  sourceRef?: string | null
}): string | null {
  const fromSource = record.sourceId?.trim()
  if (fromSource && isPresentNotebookGraphShardKey(fromSource)) return fromSource
  const fromShard = record.shardMonth?.trim()
  if (fromShard && isPresentNotebookGraphShardKey(fromShard)) return fromShard
  return notebookGraphSourceIdFromSourceRef(record.sourceRef)
}

function sourceIdFromNode(node: NotebookGraphNodeRawRecord): string | null {
  const fromProps = node.props && typeof node.props.sourceId === 'string' ? node.props.sourceId : ''
  if (isPresentNotebookGraphShardKey(fromProps)) return fromProps.trim()
  const alias = node.aliases?.[0]?.trim() ?? ''
  if (isPresentNotebookGraphShardKey(alias)) return alias
  const name = node.name.trim()
  if (isPresentNotebookGraphShardKey(name)) return name
  return resolveNotebookGraphShardKey(node)
}

export function groupLegacyNotebookGraphRows(input: {
  nodes: NotebookGraphNodeRawRecord[]
  edges: NotebookGraphEdgeRawRecord[]
  extractStates: NotebookGraphExtractStateRawRecord[]
}): {
  nodesBySource: Map<string, NotebookGraphNodeRawRecord[]>
  edgesBySource: Map<string, NotebookGraphEdgeRawRecord[]>
  extractStatesBySource: Map<string, NotebookGraphExtractStateRawRecord[]>
} {
  const edgesBySource = new Map<string, NotebookGraphEdgeRawRecord[]>()
  const nodeIdsBySource = new Map<string, Set<string>>()

  const addNodeId = (sourceId: string, id: string) => {
    let set = nodeIdsBySource.get(sourceId)
    if (!set) {
      set = new Set()
      nodeIdsBySource.set(sourceId, set)
    }
    set.add(id)
  }

  for (const edge of input.edges) {
    if (!edge?.id || edge.deletedAt) continue
    const sourceId =
      notebookGraphSourceIdFromSourceRef(edge.sourceRef) ?? NOTEBOOK_GRAPH_LEGACY_SHARD_KEY
    const list = edgesBySource.get(sourceId) ?? []
    list.push({ ...edge, shardMonth: sourceId, deletedAt: null })
    edgesBySource.set(sourceId, list)
    addNodeId(sourceId, edge.fromId)
    addNodeId(sourceId, edge.toId)
  }

  const nodesById = new Map<string, NotebookGraphNodeRawRecord>()
  for (const node of input.nodes) {
    if (!node?.id || node.deletedAt) continue
    nodesById.set(node.id, node)
    if (node.nodeType === 'source') {
      const sourceId = sourceIdFromNode(node)
      if (sourceId) addNodeId(sourceId, node.id)
    }
  }

  const assigned = new Set<string>()
  const nodesBySource = new Map<string, NotebookGraphNodeRawRecord[]>()
  for (const [sourceId, ids] of nodeIdsBySource) {
    const rows: NotebookGraphNodeRawRecord[] = []
    for (const id of ids) {
      const node = nodesById.get(id)
      if (!node) continue
      assigned.add(id)
      rows.push({ ...node, shardMonth: sourceId, deletedAt: null })
    }
    if (rows.length > 0) nodesBySource.set(sourceId, rows)
  }

  const leftover: NotebookGraphNodeRawRecord[] = []
  for (const node of nodesById.values()) {
    if (assigned.has(node.id)) continue
    leftover.push({
      ...node,
      shardMonth: NOTEBOOK_GRAPH_LEGACY_SHARD_KEY,
      deletedAt: null
    })
  }
  if (leftover.length > 0) {
    const existing = nodesBySource.get(NOTEBOOK_GRAPH_LEGACY_SHARD_KEY) ?? []
    nodesBySource.set(NOTEBOOK_GRAPH_LEGACY_SHARD_KEY, [...existing, ...leftover])
  }

  const extractStatesBySource = new Map<string, NotebookGraphExtractStateRawRecord[]>()
  for (const state of input.extractStates) {
    if (!state?.id || state.deletedAt) continue
    const sourceId = state.sourceId.trim()
    if (!isPresentNotebookGraphShardKey(sourceId)) continue
    const list = extractStatesBySource.get(sourceId) ?? []
    list.push({ ...state, deletedAt: null })
    extractStatesBySource.set(sourceId, list)
  }

  return { nodesBySource, edgesBySource, extractStatesBySource }
}
