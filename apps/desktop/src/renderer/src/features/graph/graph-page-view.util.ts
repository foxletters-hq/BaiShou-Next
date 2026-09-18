import type { GraphFocusDepth } from '@baishou/shared'
import type { GraphNameCandidate, GraphPageNode } from './graph-page.types'

export function viewDepthFor(depth: GraphFocusDepth): 1 | 2 | 3 {
  return depth === 3 ? 3 : depth === 2 ? 2 : 1
}

export function parseGraphNodeProps(
  node: { propsJson?: string | null } | null
): Record<string, unknown> {
  try {
    return JSON.parse(node?.propsJson || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

export function readGraphNodeSuspectReason(node: { propsJson?: string | null } | null): string {
  const raw = parseGraphNodeProps(node).suspectReason
  return typeof raw === 'string' ? raw.trim() : ''
}

export function isGraphExtractDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

export function parseGraphAliasInput(raw: string): string[] {
  return raw
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function graphBareNodeIdForRevert(
  selectedNode: Pick<GraphPageNode, 'id' | 'discriminator'> | null,
  nameCandidates: GraphNameCandidate[]
): string {
  if (!selectedNode) return ''
  return (
    nameCandidates.find((item) => !item.discriminator)?.nodeId ||
    (!selectedNode.discriminator ? selectedNode.id : '')
  )
}

export function graphRevertSplitStayId(opts: {
  selectedNodeId: string
  removedNodeId?: string
  bareNodeId: string
}): string {
  return opts.removedNodeId && opts.selectedNodeId === opts.removedNodeId
    ? opts.bareNodeId
    : opts.selectedNodeId
}

export function graphSplitInitialLabel(
  selectedNode: Pick<GraphPageNode, 'id' | 'discriminator'> | null,
  nameCandidates: GraphNameCandidate[]
): string {
  if (!selectedNode?.discriminator) return ''
  return (
    nameCandidates.find((item) => item.nodeId === selectedNode.id)?.label ||
    selectedNode.discriminator
  )
}

export function graphMergeSearchSeed(opts: {
  selectedId: string | null
  selectedNode: GraphPageNode | null
  findNode: (id: string) => GraphPageNode | null
}): { id: string; name: string; nodeType: string } | null {
  if (!opts.selectedId) return null
  const n =
    opts.selectedNode?.id === opts.selectedId ? opts.selectedNode : opts.findNode(opts.selectedId)
  if (!n || n.nodeType === 'entry') return null
  return { id: n.id, name: String(n.name || n.id), nodeType: String(n.nodeType || '') }
}
