import { isValidShardMonth } from './raw-data-month.util'

/** 无法归属到资料的旧月分片节点，写入此键；缺席删除不把它当作某资料已到齐。 */
export const NOTEBOOK_GRAPH_LEGACY_SHARD_KEY = '_legacy'

/**
 * 知识本图谱分片键：资料 id（如 src_… / note_…）或 _legacy。
 * 拒绝路径分隔、父目录、以及日历月 YYYY-MM。
 */
export function isValidNotebookGraphShardKey(value: string): boolean {
  const key = value.trim()
  if (!key) return false
  if (key.includes('/') || key.includes('\\') || key.includes('..')) return false
  if (isValidShardMonth(key)) return false
  if (key === NOTEBOOK_GRAPH_LEGACY_SHARD_KEY) return true
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(key)
}

export function isPresentNotebookGraphShardKey(value: string): boolean {
  const key = value.trim()
  return isValidNotebookGraphShardKey(key) && key !== NOTEBOOK_GRAPH_LEGACY_SHARD_KEY
}

/** sourceRef 形如 src_ab12#0 → src_ab12 */
export function notebookGraphSourceIdFromSourceRef(
  sourceRef: string | null | undefined
): string | null {
  const prefix = (sourceRef ?? '').trim().split('#')[0]?.trim() ?? ''
  if (!isPresentNotebookGraphShardKey(prefix)) return null
  return prefix
}

export function notebookGraphDeletedShardPaths(notebookId: string, sourceId: string): string[] {
  const nb = notebookId.trim()
  const src = sourceId.trim()
  if (!nb || !src) return []
  return [
    `Notebooks/${nb}/graph/nodes/${src}.jsonl`,
    `Notebooks/${nb}/graph/edges/${src}.jsonl`
  ]
}
