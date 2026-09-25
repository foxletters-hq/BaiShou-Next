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

/** 侧栏角标：超过 99 项时收成 99+，避免把 32px 按钮撑开 */
export function formatGraphRailCount(count: number): string {
  if (count <= 0) return ''
  return count > 99 ? '99+' : String(count)
}

/** 待确认，或仍带可疑标记时，都可以在详情/拆分页点通过或解除怀疑 */
export function canApproveGraphNode(
  node: { reviewStatus?: string; propsJson?: string | null } | null
): boolean {
  if (!node) return false
  return node.reviewStatus === 'pending' || Boolean(readGraphNodeSuspectReason(node))
}

export function graphSuspectReviewCopy(node: { propsJson?: string | null } | null): {
  actionKey: string
  actionDefault: string
  doneKey: string
  doneDefault: string
} {
  if (readGraphNodeSuspectReason(node)) {
    return {
      actionKey: 'graph.clear_suspect',
      actionDefault: '解除怀疑',
      doneKey: 'graph.clear_suspect_done',
      doneDefault: '已解除怀疑'
    }
  }
  return {
    actionKey: 'graph.approve',
    actionDefault: '通过',
    doneKey: 'graph.approve_done',
    doneDefault: '通过成功'
  }
}

export function stripGraphNodeSuspectReason<T extends { propsJson?: string | null }>(node: T): T {
  const props = parseGraphNodeProps(node)
  if (!('suspectReason' in props)) return node
  const next = { ...props }
  delete next.suspectReason
  return { ...node, propsJson: JSON.stringify(next) }
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
  forbiddenNodeTypes?: readonly string[]
}): { id: string; name: string; nodeType: string } | null {
  if (!opts.selectedId) return null
  const n =
    opts.selectedNode?.id === opts.selectedId ? opts.selectedNode : opts.findNode(opts.selectedId)
  const forbidden = new Set(opts.forbiddenNodeTypes ?? ['entry'])
  if (!n || forbidden.has(n.nodeType)) return null
  return { id: n.id, name: String(n.name || n.id), nodeType: String(n.nodeType || '') }
}
