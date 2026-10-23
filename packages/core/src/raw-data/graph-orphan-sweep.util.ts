import { isValidGraphMonth } from '@baishou/shared'
import { isPresentNotebookGraphShardKey } from './notebook-graph-shard-key.util'

export type GraphAbsentSweepMode = 'shard-present' | 'off'

export type GraphShardCollection = 'nodes' | 'edges'

export type GraphLiveRef = {
  id: string
  shardMonth: string
}

export type ParsedGraphShardPath = {
  collection: GraphShardCollection
  shardMonth: string
  notebookId?: string
}

const MONTH_JSONL_RE = /(\d{4}-\d{2})\.jsonl$/i

/** Parse Graph/ or Notebooks/<id>/graph/ jsonl paths from incremental sync deletes. */
export function parseGraphDeletedShardPath(relativePath: string): ParsedGraphShardPath | null {
  const p = relativePath.replace(/\\/g, '/')

  const notebook = p.match(/(?:^|\/)Notebooks\/([^/]+)\/graph\/(nodes|edges)\/([^/]+)\.jsonl$/i)
  if (notebook?.[1] && notebook[2] && notebook[3]) {
    const key = notebook[3]
    if (!isPresentNotebookGraphShardKey(key)) return null
    return {
      collection: notebook[2].toLowerCase() as GraphShardCollection,
      shardMonth: key,
      notebookId: notebook[1]
    }
  }

  const month = p.match(MONTH_JSONL_RE)?.[1]
  if (!month || !isValidGraphMonth(month)) return null

  const diary = p.match(/(?:^|\/)Graph\/(nodes|edges)\//i)
  if (diary?.[1]) {
    return {
      collection: diary[1].toLowerCase() as GraphShardCollection,
      shardMonth: month
    }
  }

  return null
}

export function collectPresentMonths(opts: {
  shardMonths: readonly string[]
  deletedPaths?: readonly string[]
  collection: GraphShardCollection
  notebookId?: string
}): Set<string> {
  const out = new Set<string>()
  const accept = opts.notebookId
    ? isPresentNotebookGraphShardKey
    : (value: string) => isValidGraphMonth(value)
  for (const month of opts.shardMonths) {
    const trimmed = month.trim()
    if (accept(trimmed)) out.add(trimmed)
  }
  for (const raw of opts.deletedPaths ?? []) {
    const parsed = parseGraphDeletedShardPath(raw)
    if (!parsed || parsed.collection !== opts.collection) continue
    if (opts.notebookId) {
      if (parsed.notebookId !== opts.notebookId) continue
    } else if (parsed.notebookId) {
      continue
    }
    out.add(parsed.shardMonth)
  }
  return out
}

/** Absence-delete only when the row's shard file is present locally (or deleted by sync). */
export function shouldAbsentDelete(opts: {
  id: string
  shardMonth: string
  liveIds: ReadonlySet<string>
  presentMonths: ReadonlySet<string>
}): boolean {
  if (opts.liveIds.has(opts.id)) return false
  const key = opts.shardMonth.trim()
  if (!isValidGraphMonth(key) && !isPresentNotebookGraphShardKey(key)) return false
  return opts.presentMonths.has(key)
}

export function collectAbsentDeleteIds(
  refs: readonly GraphLiveRef[],
  liveIds: ReadonlySet<string>,
  presentMonths: ReadonlySet<string>
): string[] {
  const out: string[] = []
  for (const ref of refs) {
    if (shouldAbsentDelete({ id: ref.id, shardMonth: ref.shardMonth, liveIds, presentMonths })) {
      out.push(ref.id)
    }
  }
  return out
}
