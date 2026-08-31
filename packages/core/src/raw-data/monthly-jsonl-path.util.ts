import { isValidShardMonth } from './raw-data-month.util'
import { isValidNotebookGraphShardKey } from './notebook-graph-shard-key.util'

export type GraphJsonlCollection = 'nodes' | 'edges' | 'extract-state'

export type MonthlyJsonlClassification =
  | { kind: 'memory'; shardFile: string; shardMonth: string }
  | {
      kind: 'graph'
      collection: GraphJsonlCollection
      shardFile: string
      shardMonth: string
    }
  | {
      kind: 'notebook-graph'
      notebookId: string
      collection: GraphJsonlCollection
      shardFile: string
      shardMonth: string
    }

function shardMonthOf(shardFile: string): string {
  return shardFile.replace(/\.jsonl$/i, '')
}

/**
 * Memory / vault Graph / notebook graph monthly JSONL shards.
 * Used to refresh pending-index after an out-of-band write.
 */
export function isMonthlyJsonlRawPath(filePath: string): boolean {
  return classifyMonthlyJsonlPath(filePath) != null
}

export function classifyMonthlyJsonlPath(filePath: string): MonthlyJsonlClassification | null {
  const p = filePath.replace(/\\/g, '/')
  if (p.endsWith('shards.manifest.json')) return null

  const mem = p.match(/(?:^|\/)Memory\/([^/]+\.jsonl)$/i)
  if (mem) {
    const shardFile = mem[1]!
    return { kind: 'memory', shardFile, shardMonth: shardMonthOf(shardFile) }
  }

  const notebook = p.match(
    /(?:^|\/)Notebooks\/([^/]+)\/graph\/(nodes|edges|extract-state)\/([^/]+\.jsonl)$/i
  )
  if (notebook) {
    const shardFile = notebook[3]!
    return {
      kind: 'notebook-graph',
      notebookId: notebook[1]!,
      collection: notebook[2]!.toLowerCase() as GraphJsonlCollection,
      shardFile,
      shardMonth: shardMonthOf(shardFile)
    }
  }

  const graph = p.match(/(?:^|\/)Graph\/(nodes|edges|extract-state)\/([^/]+\.jsonl)$/i)
  if (graph) {
    const shardFile = graph[2]!
    return {
      kind: 'graph',
      collection: graph[1]!.toLowerCase() as GraphJsonlCollection,
      shardFile,
      shardMonth: shardMonthOf(shardFile)
    }
  }
  return null
}

/**
 * Only Memory shards line-merge on conflict.
 * Vault Graph and notebook-graph shards overwrite the whole file.
 */
export function shouldLineMergeMonthlyJsonlOnConflict(filePath: string): boolean {
  return classifyMonthlyJsonlPath(filePath)?.kind === 'memory'
}

export function shardKeyValidatorForJsonlKind(
  kind: MonthlyJsonlClassification['kind']
): (value: string) => boolean {
  if (kind === 'notebook-graph') {
    return (value) => isValidNotebookGraphShardKey(value) || isValidShardMonth(value)
  }
  return isValidShardMonth
}

export type JsonlConflictOutcome = 'merged' | 'uploaded' | 'downloaded'

/** Shared conflict branch for desktop and mobile incremental sync. */
export async function applyJsonlConflictResolved(input: {
  filePath: string
  direction: 'upload' | 'download' | undefined
  lineMerge: () => Promise<boolean>
  overwriteUpload: () => Promise<void>
  overwriteDownload: () => Promise<void>
}): Promise<JsonlConflictOutcome> {
  const direction = input.direction === 'upload' ? 'upload' : 'download'
  if (shouldLineMergeMonthlyJsonlOnConflict(input.filePath)) {
    if (await input.lineMerge()) return 'merged'
  }
  if (direction === 'upload') {
    await input.overwriteUpload()
    return 'uploaded'
  }
  await input.overwriteDownload()
  return 'downloaded'
}
