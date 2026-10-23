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

export type NotebookStructureJsonlClassification = {
  /** 相对 Notebooks/ 的路径：notebooks.jsonl 或 <notebookId>/sources.jsonl */
  relativePath: string
}

/**
 * Notebooks 结构层（notebooks.jsonl / <nb>/sources.jsonl）是追加型 JSONL，
 * 按 id/updatedAt 做行级 LWW；不要与月分片混淆。
 */
export function classifyNotebookStructureJsonlPath(
  filePath: string
): NotebookStructureJsonlClassification | null {
  const p = filePath.replace(/\\/g, '/')
  const notebookList = p.match(/(?:^|\/)Notebooks\/(notebooks\.jsonl)$/i)
  if (notebookList) return { relativePath: notebookList[1]! }
  const sources = p.match(/(?:^|\/)Notebooks\/([^/]+)\/sources\.jsonl$/i)
  if (sources) {
    const notebookId = sources[1]!.trim()
    if (!notebookId || notebookId === '.' || notebookId === '..') return null
    return { relativePath: `${notebookId}/sources.jsonl` }
  }
  return null
}

export function isNotebookStructureJsonlPath(filePath: string): boolean {
  return classifyNotebookStructureJsonlPath(filePath) != null
}

/**
 * Only Memory shards line-merge on conflict.
 * Vault Graph and notebook-graph shards overwrite the whole file.
 */
export function shouldLineMergeMonthlyJsonlOnConflict(filePath: string): boolean {
  return classifyMonthlyJsonlPath(filePath)?.kind === 'memory'
}

/** 同步冲突需要走行级 LWW 的 JSONL：Memory 月分片 + Notebooks 结构层。 */
export function shouldLineMergeJsonlOnConflict(filePath: string): boolean {
  return shouldLineMergeMonthlyJsonlOnConflict(filePath) || isNotebookStructureJsonlPath(filePath)
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
  if (shouldLineMergeJsonlOnConflict(input.filePath)) {
    if (await input.lineMerge()) return 'merged'
  }
  if (direction === 'upload') {
    await input.overwriteUpload()
    return 'uploaded'
  }
  await input.overwriteDownload()
  return 'downloaded'
}
