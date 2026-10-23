import { normalizeGraphName, type GraphSameNameExisting } from '@baishou/shared'

type NameHit = {
  id: string
  name: string
  nodeType: string
  summary?: string
}

function toExisting(hit: NameHit): GraphSameNameExisting {
  return {
    id: hit.id,
    name: hit.name,
    nodeType: hit.nodeType,
    summary: hit.summary ?? ''
  }
}

async function lookupByName(query: string, nodeType: string): Promise<NameHit | null> {
  const graph = window.api?.graph
  if (graph && typeof graph.findByName === 'function') {
    return (await graph.findByName({ query, nodeType })) as NameHit | null
  }
  if (graph && typeof graph.search === 'function') {
    const found = (await graph.search({
      query,
      nodeTypes: [nodeType],
      limit: 20
    })) as NameHit[]
    const norm = normalizeGraphName(query)
    return (
      found.find(
        (n) =>
          n?.id &&
          n.nodeType === nodeType &&
          (String(n.name) === query || normalizeGraphName(String(n.name)) === norm)
      ) ?? null
    )
  }
  return null
}

export async function findGraphSameNameNode(opts: {
  name: string
  nodeType: string
  exceptId?: string
}): Promise<GraphSameNameExisting | null> {
  const name = opts.name.trim()
  if (!name || !opts.nodeType.trim()) return null
  try {
    const hit = await lookupByName(name, opts.nodeType)
    if (!hit?.id || hit.id === opts.exceptId) return null
    return toExisting(hit)
  } catch {
    return null
  }
}
