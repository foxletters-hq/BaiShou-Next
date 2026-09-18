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

/** 同名可并存时，只把「区分信息相同且不是自己」当成写入冲突。 */
export function pickSameNameConflictFromHits<
  T extends {
    id: string
    name: string
    nodeType: string
    summary?: string | null
    discriminator?: string | null
  }
>(
  hits: readonly T[],
  currentId: string | undefined,
  currentDiscriminator: string
): GraphSameNameExisting | null {
  return graphSameNameExistingFromRow(
    hits.find(
      (row) => row.id !== currentId && (row.discriminator ?? '') === currentDiscriminator
    ) ?? null,
    currentId
  )
}

export function isGraphNodeSameNameConflict(
  result: GraphNodeWriteResult
): result is { conflict: 'same-name'; existing: GraphSameNameExisting } {
  return 'conflict' in result && result.conflict === 'same-name'
}
