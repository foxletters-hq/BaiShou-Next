import { normalizeGraphFilePath } from './graph-identity.util'

export type DiaryGraphFollowCandidate = {
  filePath: string
  date?: string
  contentHash?: string
}

/**
 * 日记向量完成后要不要接抽图：只收「正文哈希与 extract-state 不一致 / 从未抽过」的篇。
 * 已抽过且正文没变的不入队，避免向量重算或重复完成触发死循环。
 */
export function selectDiaryGraphFollowUpItems(input: {
  wanted: DiaryGraphFollowCandidate[]
  pendingReextract: DiaryGraphFollowCandidate[]
}): DiaryGraphFollowCandidate[] {
  const pending = new Map<string, DiaryGraphFollowCandidate>()
  for (const row of input.pendingReextract) {
    const filePath = normalizeGraphFilePath(row.filePath)
    if (!filePath) continue
    pending.set(filePath, {
      filePath,
      date: row.date,
      contentHash: row.contentHash
    })
  }

  const seen = new Set<string>()
  const items: DiaryGraphFollowCandidate[] = []
  for (const raw of input.wanted) {
    const filePath = normalizeGraphFilePath(raw.filePath)
    if (!filePath || seen.has(filePath)) continue
    const hit = pending.get(filePath)
    if (!hit) continue
    seen.add(filePath)
    items.push({
      filePath,
      date: raw.date || hit.date,
      contentHash: raw.contentHash || hit.contentHash
    })
  }
  return items
}

/** 用户取消过的篇：同路径且同正文哈希不再自动接上。 */
export function isDiaryGraphFollowCancelled(input: {
  filePath: string
  contentHash?: string
  cancelled: ReadonlyMap<string, string>
}): boolean {
  const filePath = normalizeGraphFilePath(input.filePath)
  if (!filePath || !input.cancelled.has(filePath)) return false
  const cancelledHash = input.cancelled.get(filePath)
  if (cancelledHash == null || cancelledHash === '') return true
  const current = String(input.contentHash || '').trim()
  if (!current) return true
  return cancelledHash === current
}
