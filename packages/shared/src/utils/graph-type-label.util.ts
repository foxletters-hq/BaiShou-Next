/** Fallback labels (zh) when i18n keys are missing. */
export const GRAPH_EDGE_TYPE_LABEL_FALLBACKS: Record<string, string> = {
  mentions: '提及',
  participates_in: '参与',
  located_at: '位于',
  evokes: '唤起',
  role_of: '角色',
  relates_to: '相关'
}

export const GRAPH_NODE_TYPE_LABEL_FALLBACKS: Record<string, string> = {
  person: '人物',
  place: '地点',
  organization: '组织',
  event: '事件',
  emotion: '情绪',
  topic: '主题',
  work: '作品',
  activity: '活动',
  product: '产品',
  food: '食物',
  entry: '日记锚点'
}

type TranslateFn = (key: string, defaultValue?: string) => string

export function asGraphTranslateFn(t: unknown): TranslateFn {
  return (key, defaultValue) => (t as TranslateFn)(key, defaultValue)
}

export function translateGraphEdgeType(t: TranslateFn, edgeType: string): string {
  const key = String(edgeType || '').trim()
  if (!key) return ''
  return t(`graph.edge_type.${key}`, GRAPH_EDGE_TYPE_LABEL_FALLBACKS[key] ?? key)
}

export function translateGraphNodeType(t: TranslateFn, nodeType: string): string {
  const key = String(nodeType || '').trim()
  if (!key) return ''
  return t(`graph.node_type.${key}`, GRAPH_NODE_TYPE_LABEL_FALLBACKS[key] ?? key)
}
