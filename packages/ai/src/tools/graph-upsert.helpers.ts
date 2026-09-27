import { isRealLocalCalendarDate } from '@baishou/shared'

export function collapseGraphDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function graphUpsertSourceRefError(sourceRef: string): string | null {
  const raw = sourceRef.trim()
  if (!raw) return null
  if (raw.startsWith('mem_') || raw.includes('memory')) return null
  const date = raw.match(/(\d{4}-\d{2}-\d{2})/)
  if (date) {
    return isRealLocalCalendarDate(date[1])
      ? null
      : `source_ref 不是有效日期: ${date[1]}。请使用真实的 YYYY-MM-DD。`
  }
  if (raw.includes('Journals/')) return null
  return `source_ref 不是有效日期: ${raw}。请使用真实的 YYYY-MM-DD 或记忆 id。`
}

export type GraphUpsertSkipReason = 'missing_id' | 'not_found' | 'missing_node'

export type GraphUpsertSkip = {
  reason: GraphUpsertSkipReason
  from?: string
  to?: string
  id?: string
}

export function formatGraphUpsertSkipReceipt(skips: GraphUpsertSkip[]): string {
  if (skips.length === 0) return ''
  const details = skips.map((skip) => {
    const bits: string[] = []
    if (skip.from) bits.push(`from=${skip.from}`)
    if (skip.to) bits.push(`to=${skip.to}`)
    if (skip.id) bits.push(`id=${skip.id}`)
    bits.push(`reason=${skip.reason}`)
    return bits.join(' ')
  })
  return `（跳过 ${skips.length}：${details.join('；')}）`
}

export function formatGraphUpsertCounts(input: {
  nodesCreated: number
  nodesUpdated: number
  edgesWritten: number
  edgesUpdated: number
  edgesDeleted: number
  skips: GraphUpsertSkip[]
}): string {
  return (
    `已写入人生关系图：新建节点 ${input.nodesCreated}，更新节点 ${input.nodesUpdated}，边 ${input.edgesWritten}` +
    (input.edgesUpdated ? `，改边 ${input.edgesUpdated}` : '') +
    (input.edgesDeleted ? `，删边 ${input.edgesDeleted}` : '') +
    formatGraphUpsertSkipReceipt(input.skips) +
    '（已生效，可被回忆检索）。'
  )
}
