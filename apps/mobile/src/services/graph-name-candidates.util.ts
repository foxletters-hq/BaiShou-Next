import { readGraphNameRegistry } from '@baishou/shared'

export function pickBareGraphNameHit<T>(hits: readonly T[]): {
  hit: T | null
  ambiguous: boolean
} {
  if (hits.length === 0) return { hit: null, ambiguous: false }
  return { hit: hits[0] ?? null, ambiguous: hits.length > 1 }
}

export function parseGraphNodePropsJson(raw?: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

export function readGraphNodeSuspectReason(node: { propsJson?: string | null } | null): string {
  const raw = parseGraphNodePropsJson(node?.propsJson).suspectReason
  return typeof raw === 'string' ? raw.trim() : ''
}

export function graphBareNodeIdForRevert(
  selectedNode: { id: string; discriminator?: string | null } | null,
  sameNameEntities: readonly { nodeId: string; discriminator?: string | null }[]
): string {
  if (!selectedNode) return ''
  return (
    sameNameEntities.find((item) => !item.discriminator)?.nodeId ||
    (!selectedNode.discriminator ? selectedNode.id : '')
  )
}

export function graphRevertSplitStayId(opts: {
  selectedNodeId: string
  removedNodeId?: string | null
  bareNodeId: string
}): string {
  return opts.removedNodeId && opts.selectedNodeId === opts.removedNodeId
    ? opts.bareNodeId
    : opts.selectedNodeId
}

export type GraphRegisteredSameNameEntity = {
  nodeId: string
  name: string
  discriminator: string
  label: string
}

/**
 * 登记只写在裸名节点上。当前是裸名时直接读自己；当前是拆出的实体时，
 * 用裸名节点的登记列出兄弟，并补上裸名自己。
 */
export function listRegisteredSameNameEntities(input: {
  currentId: string
  currentName: string
  currentDiscriminator?: string | null
  currentProps: Record<string, unknown>
  bareNode?: { id: string; props: Record<string, unknown> } | null
}): GraphRegisteredSameNameEntity[] {
  const currentDiscriminator = (input.currentDiscriminator ?? '').trim()
  const registry = readGraphNameRegistry(
    currentDiscriminator ? (input.bareNode?.props ?? {}) : input.currentProps
  )
  const listed: GraphRegisteredSameNameEntity[] = []
  if (currentDiscriminator && input.bareNode && input.bareNode.id !== input.currentId) {
    listed.push({
      nodeId: input.bareNode.id,
      name: input.currentName,
      discriminator: '',
      label: ''
    })
  }
  for (const entry of registry) {
    if (entry.nodeId === input.currentId) continue
    listed.push({
      nodeId: entry.nodeId,
      name: input.currentName,
      discriminator: entry.discriminator,
      label: entry.label
    })
  }
  return listed
}
