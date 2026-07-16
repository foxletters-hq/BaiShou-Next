/**
 * Paths that participate in line-level LWW merge during three-way sync.
 * Memory/*.jsonl and Graph/{nodes,edges,extract-state}/*.jsonl only.
 * shards.manifest.json is excluded.
 */
export function isMonthlyJsonlRawPath(filePath: string): boolean {
  const p = filePath.replace(/\\/g, '/')
  if (p.endsWith('shards.manifest.json')) return false
  if (/^Memory\/[^/]+\.jsonl$/i.test(p) || /\/Memory\/[^/]+\.jsonl$/i.test(p)) {
    return true
  }
  if (
    /^Graph\/(nodes|edges|extract-state)\/[^/]+\.jsonl$/i.test(p) ||
    /\/Graph\/(nodes|edges|extract-state)\/[^/]+\.jsonl$/i.test(p)
  ) {
    return true
  }
  return false
}

export function classifyMonthlyJsonlPath(
  filePath: string
):
  | { kind: 'memory'; shardFile: string; shardMonth: string }
  | {
      kind: 'graph'
      collection: 'nodes' | 'edges' | 'extract-state'
      shardFile: string
      shardMonth: string
    }
  | null {
  const p = filePath.replace(/\\/g, '/')
  const mem = p.match(/(?:^|\/)Memory\/([^/]+\.jsonl)$/i)
  if (mem) {
    const shardFile = mem[1]!
    return {
      kind: 'memory',
      shardFile,
      shardMonth: shardFile.replace(/\.jsonl$/i, '')
    }
  }
  const graph = p.match(/(?:^|\/)Graph\/(nodes|edges|extract-state)\/([^/]+\.jsonl)$/i)
  if (graph) {
    const shardFile = graph[2]!
    return {
      kind: 'graph',
      collection: graph[1]!.toLowerCase() as 'nodes' | 'edges' | 'extract-state',
      shardFile,
      shardMonth: shardFile.replace(/\.jsonl$/i, '')
    }
  }
  return null
}
