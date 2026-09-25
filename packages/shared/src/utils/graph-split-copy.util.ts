export const GRAPH_SPLIT_EDGE_PAGE_SIZE = 20

export function graphSplitNewDisplayName(input: {
  nodeName: string
  discriminator: string
  label: string
}): string {
  const label = input.label.trim()
  if (label) return label
  const name = input.nodeName.trim()
  const discriminator = input.discriminator.trim()
  if (name && discriminator) return `${name}（${discriminator}）`
  return name || discriminator
}

export function sliceGraphSplitEdges<T>(edges: readonly T[], page: number, pageSize = GRAPH_SPLIT_EDGE_PAGE_SIZE): T[] {
  const totalPages = Math.max(1, Math.ceil(edges.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return edges.slice(start, start + pageSize)
}

export function graphSplitEdgePageCount(edgeCount: number, pageSize = GRAPH_SPLIT_EDGE_PAGE_SIZE): number {
  if (edgeCount <= 0) return 1
  return Math.ceil(edgeCount / pageSize)
}

/** 只要新实体已经写出，确认拆分就该收尾；先不管的关系下次再分。 */
export function shouldCloseGraphSplitAfterSave(result: {
  splitNodeId?: string | null
}): boolean {
  return Boolean(result.splitNodeId?.trim())
}

/** 日记锚点常把日期或路径当成名字，拆分列表里只露出日期。 */
export function formatGraphSplitPartnerName(name: string): string {
  const raw = name.trim()
  const matched = raw.match(/(\d{4}-\d{2}-\d{2})/)
  if (!matched) return raw
  const rest = raw.replace(matched[1], '').replace(/[/\\._-]+/g, '')
  if (rest.length === 0) return matched[1]
  return raw
}
