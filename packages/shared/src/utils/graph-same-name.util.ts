export type GraphSameNameExisting = {
  id: string
  name: string
  nodeType: string
  summary: string
}

export type GraphNodeWriteResult =
  | { id: string }
  | { conflict: 'same-name'; existing: GraphSameNameExisting }

export function graphSameNameExistingFromRow(
  row: { id: string; name: string; nodeType: string; summary?: string | null } | null | undefined,
  currentId?: string | null
): GraphSameNameExisting | null {
  if (!row?.id) return null
  if (currentId && row.id === currentId) return null
  return {
    id: row.id,
    name: row.name,
    nodeType: row.nodeType,
    summary: row.summary ?? ''
  }
}

export function isGraphNodeSameNameConflict(
  result: GraphNodeWriteResult
): result is { conflict: 'same-name'; existing: GraphSameNameExisting } {
  return 'conflict' in result && result.conflict === 'same-name'
}
