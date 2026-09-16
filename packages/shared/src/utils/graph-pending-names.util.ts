import { uniqueNonEmptyIds } from './graph-review-batch.util'

export const GRAPH_UNKNOWN_NODE_NAME = '未知节点'

export function collectGraphEdgeEndpointIds(
  edges: Array<{ fromId?: string | null; toId?: string | null }>
): string[] {
  const ids: string[] = []
  for (const edge of edges) {
    ids.push(String(edge.fromId ?? ''), String(edge.toId ?? ''))
  }
  return uniqueNonEmptyIds(ids)
}

export function buildGraphNodeNameMap(
  nodes: Array<{ id?: string | null; name?: string | null }>
): Map<string, string> {
  const map = new Map<string, string>()
  for (const node of nodes) {
    const id = String(node.id ?? '').trim()
    const name = String(node.name ?? '').trim()
    if (!id || !name) continue
    map.set(id, name)
  }
  return map
}

export function resolveGraphNodeDisplayName(
  nameById: Map<string, string>,
  nodeId: string | null | undefined,
  unknownLabel = GRAPH_UNKNOWN_NODE_NAME
): string {
  const id = String(nodeId ?? '').trim()
  if (!id) return unknownLabel
  return nameById.get(id) || unknownLabel
}
