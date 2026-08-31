import { graphIdFromKey, normalizeGraphName } from './graph-identity.util'

/** 知识本实体：盐含 notebookId，跨本同名不合并 */
export function notebookGraphNodeIdForEntity(
  vaultId: string,
  notebookId: string,
  nodeType: string,
  name: string
): string {
  const v = vaultId.trim()
  const nb = notebookId.trim()
  const t = nodeType.trim().toLowerCase() || 'topic'
  const n = normalizeGraphName(name)
  if (!v || !nb) throw new Error('notebookGraphNodeIdForEntity: vaultId and notebookId required')
  return graphIdFromKey(`${v}\0${nb}\0${t}\0${n}`)
}

export function notebookGraphSourceNodeId(
  vaultId: string,
  notebookId: string,
  sourceId: string
): string {
  return notebookGraphNodeIdForEntity(vaultId, notebookId, 'source', sourceId)
}

export function notebookGraphEdgeId(
  vaultId: string,
  notebookId: string,
  fromId: string,
  toId: string,
  edgeType: string,
  sourceRef: string | null | undefined
): string {
  const v = vaultId.trim()
  const nb = notebookId.trim()
  const et = edgeType.trim().toLowerCase() || 'relates_to'
  const ref = (sourceRef ?? '').trim()
  if (!v || !nb) throw new Error('notebookGraphEdgeId: vaultId and notebookId required')
  return graphIdFromKey(`${v}\0${nb}\0${fromId}\0${toId}\0${et}\0${ref}`)
}

export function notebookGraphExtractStateId(notebookId: string, sourceId: string): string {
  return graphIdFromKey(`extract-state\0${notebookId.trim()}\0${sourceId.trim()}`)
}

/** Prefer the notebook content-addressable id so unique-index merges do not flip-flop. */
export function shouldKeepIncomingNotebookGraphNodeId(opts: {
  vaultId: string
  notebookId: string
  nodeType: string
  name: string
  incomingId: string
  existingId: string
}): boolean {
  const stable = notebookGraphNodeIdForEntity(opts.vaultId, opts.notebookId, opts.nodeType, opts.name)
  if (opts.incomingId === stable) return true
  if (opts.existingId === stable) return false
  return false
}
