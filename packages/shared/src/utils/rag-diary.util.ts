import { coerceDiaryCalendarDate, formatLocalDate, parseDateStr } from './date.utils'
import { logger } from './logger'
import { sha256Pure } from './sha256-pure'

/** 日记向量分块前缀：只带日期，不带元数据标签 */
export function buildDiaryEmbeddingDatePrefix(date: Date | string): string {
  const d = coerceDiaryCalendarDate(date)
  if (!d) return ''
  return `[${formatLocalDate(d)} 日记:]\n`
}

/** 日记嵌入入参：正文原样作为 text，日期前缀单独放在 chunkPrefix。 */
export function buildDiaryEmbeddingTextArgs(
  content: string,
  date: Date | string
): { text: string; chunkPrefix: string } {
  const d = coerceDiaryCalendarDate(date)
  return {
    text: content,
    chunkPrefix: d ? buildDiaryEmbeddingDatePrefix(d) : ''
  }
}

/** 批量嵌入时优先处理最早日记（日期从旧到新） */
export function sortDiariesByDateAsc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** 按日记日期从新到旧排序（展示等场景） */
export function sortDiariesByDateDesc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => b.date.getTime() - a.date.getTime())
}

/** @deprecated V2.2 起新写入 group_id 仅为 'diary'；保留供存量解析 */
export const DIARY_EMBED_GROUP_PREFIX = 'diary:'

/** 新写入的日记向量 group_id（仓库隔离改靠 vault_id 列） */
export const DIARY_EMBED_GROUP_ID = 'diary'

/** 新写入的记忆向量 group_id */
export const MEMORY_EMBED_GROUP_ID = 'memory'

/** 旧版未按工作空间隔离的日记嵌入 groupId（迁移时需清理） */
export const LEGACY_DIARY_EMBED_GROUP_IDS = [
  'diary_batch',
  'diary_auto',
  'diary_post_sync'
] as const

const DIARY_EMBED_SOURCE_SEP = '#'

/**
 * 日记向量 sourceId：{vaultId}#{diaryId}，避免多工作空间 numeric id 冲突。
 * 调用方须传入稳定 vaultId（非显示名）。
 */
export function buildDiaryEmbeddingSourceId(vaultId: string, diaryId: number | string): string {
  const vault = vaultId.trim()
  if (!vault) throw new Error('buildDiaryEmbeddingSourceId: vaultId is required')
  return `${vault}${DIARY_EMBED_SOURCE_SEP}${String(diaryId)}`
}

/**
 * 日记向量 groupId。V2.2 起固定为 `'diary'`（仓库隔离靠 vault_id 列）。
 * 保留可选参数以兼容旧调用方签名。
 */
export function buildDiaryEmbeddingGroupId(_vaultIdOrName?: string): string {
  return DIARY_EMBED_GROUP_ID
}

export function isLegacyDiaryEmbeddingSourceId(sourceId: string): boolean {
  return !sourceId.includes(DIARY_EMBED_SOURCE_SEP)
}

export function parseDiaryEmbeddingSourceId(
  sourceId: string
): { vaultId: string; diaryId: string } | null {
  const idx = sourceId.indexOf(DIARY_EMBED_SOURCE_SEP)
  if (idx <= 0) return null
  return {
    vaultId: sourceId.slice(0, idx),
    diaryId: sourceId.slice(idx + 1)
  }
}

/**
 * 日记待嵌入检测行。
 * `contentHash` 必须是正文 `hashEmbedSourceContent`，不能用 journals_index.content_hash（整份 Markdown 的 MD5）。
 */
export interface DiaryEmbedDetectionRow {
  id: number
  date: Date
  updatedAt?: Date
  contentHash: string
}

/** 从影子索引瘦行生成检测行：只哈希 raw_content 正文，忽略文件级 content_hash。 */
export function toDiaryEmbedDetectionRow(input: {
  id: number
  date: string | Date
  updatedAt?: string | Date | null
  rawContent?: string | null
}): DiaryEmbedDetectionRow {
  const date =
    typeof input.date === 'string' ? parseDateStr(String(input.date).split('T')[0]!) : input.date
  const updatedAt = input.updatedAt
    ? input.updatedAt instanceof Date
      ? input.updatedAt
      : new Date(input.updatedAt)
    : undefined
  return {
    id: input.id,
    date,
    updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : undefined,
    contentHash: hashEmbedSourceContent(input.rawContent ?? '')
  }
}

export function countPendingMemoriesAgainstLedger(
  liveRows: Array<{ id: string; content: string }>,
  ledgerBySourceId: Map<string, { contentHash: string; status: string }>
): number {
  let pending = 0
  for (const row of liveRows) {
    const hash = hashEmbedSourceContent(row.content)
    const ledger = ledgerBySourceId.get(row.id)
    if (!ledger || ledger.status !== 'embedded' || ledger.contentHash.trim() !== hash) {
      pending += 1
    }
  }
  return pending
}

/** 筛选尚未嵌入或日记内容已更新、需重新嵌入的条目 */
export function filterUnindexedDiaries<
  T extends { id: unknown; updatedAt?: Date; contentHash?: string }
>(
  diaries: T[],
  embeddedIds: Set<string>,
  embeddedUpdatedAtMap: Map<string, number>,
  options?: {
    resolveSourceId?: (diary: T) => string
    embeddedContentHashMap?: Map<string, string>
    resolveContentHash?: (diary: T) => string | undefined
  }
): T[] {
  const resolveSourceId = options?.resolveSourceId ?? ((d) => String(d.id))
  const embeddedContentHashMap = options?.embeddedContentHashMap
  const resolveContentHash = options?.resolveContentHash

  return diaries.filter((d) => {
    const sId = resolveSourceId(d)
    if (!embeddedIds.has(sId)) {
      return true
    }

    const ledgerHash = embeddedContentHashMap?.get(sId)?.trim() ?? ''
    const diaryHash = (resolveContentHash?.(d) ?? d.contentHash ?? '').trim()
    if (ledgerHash && diaryHash) {
      return ledgerHash !== diaryHash
    }

    const existingUpdatedAt = embeddedUpdatedAtMap.get(sId)
    if (existingUpdatedAt === undefined) {
      return true
    }
    if (d.updatedAt) {
      return d.updatedAt.getTime() > existingUpdatedAt
    }
    return false
  })
}

/** 向量 metadata_json 里的内容哈希字段名，与账本 content_hash 口径一致 */
export const EMBED_METADATA_CONTENT_HASH_KEY = 'content_hash'

export type EmbedLedgerVectorRow = {
  vaultId: string
  sourceType: string
  sourceId: string
  modelId: string
  dimension: number
  metadataJson: string
}

export type AggregatedEmbedLedgerRow = {
  vaultId: string
  sourceType: string
  sourceId: string
  contentHash: string
  chunkCount: number
  modelId: string
  dimension: number
  updatedAt: number
}

/** 重建整本账时用的保存点名；用 SAVEPOINT 而非 BEGIN，外层已有事务时也能安全嵌套。 */
export const EMBED_LEDGER_REBUILD_SAVEPOINT = 'embed_ledger_rebuild'

/** 记忆中心的条目是否来自日记 */
export function isDiaryRagEntry(sourceType?: string): boolean {
  return sourceType === 'diary'
}

/**
 * 记忆中心的条目能不能直接编辑。
 *
 * 伙伴记忆可以：编辑会把新内容写回 Memory JSONL 再重新嵌入，那一行 JSONL 就是事实来源。
 * 日记不行：日记正文才是事实来源，改切片不会回写正文，下一次补齐又会按正文重新生成、
 * 覆盖掉这次手改，而且账本的内容哈希会停在旧值。
 */
export function isRagEntryEditable(sourceType?: string): boolean {
  return !isDiaryRagEntry(sourceType) && sourceType !== 'graph_node'
}

type EmbedLedgerRebuildListener = () => Promise<void>

let embedLedgerRebuildListener: EmbedLedgerRebuildListener | null = null

/** 记忆侧注册：账本重建后作废 manifest 已索引哈希 */
export function setEmbedLedgerRebuildListener(listener: EmbedLedgerRebuildListener | null): void {
  embedLedgerRebuildListener = listener
}

export async function notifyEmbedLedgerRebuilt(): Promise<void> {
  if (!embedLedgerRebuildListener) return
  try {
    await embedLedgerRebuildListener()
  } catch (e) {
    logger.warn('embed_ledger 重建后作废记忆索引哈希失败', { error: e })
  }
}

export async function finishEmbedLedgerRebuild(onRebuilt?: () => Promise<void>): Promise<void> {
  if (onRebuilt) {
    await onRebuilt()
    return
  }
  await notifyEmbedLedgerRebuilt()
}

function parseEmbedMetadataObject(metadataJson: string | undefined): Record<string, unknown> {
  if (!metadataJson || metadataJson === '{}') return {}
  try {
    const parsed = JSON.parse(metadataJson) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* ignore malformed metadata */
  }
  return {}
}

export function extractEmbedContentHashFromMetadata(metadataJson: string | undefined): string {
  const parsed = parseEmbedMetadataObject(metadataJson)
  const hash = parsed[EMBED_METADATA_CONTENT_HASH_KEY] ?? parsed.contentHash
  return typeof hash === 'string' ? hash.trim() : ''
}

export function extractEmbedUpdatedAtFromMetadata(metadataJson: string | undefined): number {
  const parsed = parseEmbedMetadataObject(metadataJson)
  const raw = parsed.updated_at ?? parsed.updatedAt
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return 0
}

export function mergeEmbedContentHashIntoMetadata(
  metadataJson: string | undefined,
  contentHash: string | undefined
): string {
  const parsed = parseEmbedMetadataObject(metadataJson)
  const hash = contentHash?.trim() ?? ''
  if (hash) parsed[EMBED_METADATA_CONTENT_HASH_KEY] = hash
  return JSON.stringify(parsed)
}

export function canonicalizeEmbedLedgerSourceId(
  sourceType: string,
  sourceId: string,
  vaultId: string
): string {
  if (sourceType === 'diary' && isLegacyDiaryEmbeddingSourceId(sourceId) && vaultId.trim()) {
    try {
      return buildDiaryEmbeddingSourceId(vaultId, sourceId)
    } catch {
      return sourceId
    }
  }
  return sourceId
}

export function hashEmbedSourceContent(text: string): string {
  const bytes = sha256Pure(new TextEncoder().encode(text))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function pickMostFrequentString(values: string[]): string {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let best = ''
  let bestCount = -1
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

function pickMostFrequentNumber(values: number[]): number {
  const counts = new Map<number, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let best = 0
  let bestCount = -1
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

export function aggregateEmbedLedgerFromVectorRows(
  rows: EmbedLedgerVectorRow[]
): AggregatedEmbedLedgerRow[] {
  const groups = new Map<
    string,
    {
      vaultId: string
      sourceType: string
      sourceId: string
      hashes: string[]
      updatedAts: number[]
      modelIds: string[]
      dimensions: number[]
      chunkCount: number
    }
  >()

  for (const row of rows) {
    const vaultId = row.vaultId.trim()
    const sourceType = row.sourceType.trim()
    if (!vaultId || (sourceType !== 'diary' && sourceType !== 'memory')) continue
    const sourceId = canonicalizeEmbedLedgerSourceId(sourceType, row.sourceId, vaultId)
    const key = `${vaultId}\0${sourceType}\0${sourceId}`
    let group = groups.get(key)
    if (!group) {
      group = {
        vaultId,
        sourceType,
        sourceId,
        hashes: [],
        updatedAts: [],
        modelIds: [],
        dimensions: [],
        chunkCount: 0
      }
      groups.set(key, group)
    }
    group.chunkCount += 1
    const hash = extractEmbedContentHashFromMetadata(row.metadataJson)
    if (hash) group.hashes.push(hash)
    const updatedAt = extractEmbedUpdatedAtFromMetadata(row.metadataJson)
    if (updatedAt > 0) group.updatedAts.push(updatedAt)
    if (row.modelId) group.modelIds.push(row.modelId)
    if (Number.isFinite(row.dimension)) group.dimensions.push(Number(row.dimension))
  }

  return [...groups.values()].map((group) => ({
    vaultId: group.vaultId,
    sourceType: group.sourceType,
    sourceId: group.sourceId,
    contentHash: group.hashes[0] ?? '',
    chunkCount: group.chunkCount,
    modelId: pickMostFrequentString(group.modelIds),
    dimension: pickMostFrequentNumber(group.dimensions),
    updatedAt: group.updatedAts.length > 0 ? Math.max(...group.updatedAts) : 0
  }))
}
