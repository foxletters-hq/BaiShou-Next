import type { GraphFocusDepth } from '@baishou/shared'
import type { GraphNameCandidate, GraphScreenNode } from './graph-screen.types'

export function viewDepthFor(depth: GraphFocusDepth): 1 | 2 | 3 {
  return depth === 3 ? 3 : depth === 2 ? 2 : 1
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

export function graphSplitInitialLabel(
  selectedNode: Pick<GraphScreenNode, 'id' | 'discriminator'> | null,
  nameCandidates: Array<Pick<GraphNameCandidate, 'nodeId' | 'label'>>
): string {
  if (!selectedNode?.discriminator) return ''
  return (
    nameCandidates.find((item) => item.nodeId === selectedNode.id)?.label ||
    selectedNode.discriminator
  )
}

export function graphMergeSearchSeed(opts: {
  selectedId: string | null
  selectedNode: GraphScreenNode | null
  findNode: (id: string) => GraphScreenNode | null
}): { id: string; name: string; nodeType: string } | null {
  if (!opts.selectedId) return null
  const n =
    opts.selectedNode?.id === opts.selectedId ? opts.selectedNode : opts.findNode(opts.selectedId)
  if (!n || n.nodeType === 'entry') return null
  return { id: n.id, name: String(n.name || n.id), nodeType: String(n.nodeType || '') }
}
