import { FileSyncService } from './file-sync.service'
import { VaultIndexService } from './vault-index.service'
import { ShadowIndexSyncService } from '../shadow-index/shadow-index-sync.service'
import { ShadowIndexRepository } from '@baishou/database'
import {
  CreateDiaryInput,
  UpdateDiaryInput,
  Diary,
  DiaryMeta,
  DiaryListFilter,
  formatLocalDate,
  parseDateStr,
  weatherMatchesFilter,
  formatDiaryPreviewText,
  mergeDiaryTagColorRegistries,
  normalizeDiaryTagColorRegistry
} from '@baishou/shared'
import { DiaryNotFoundError, DiaryDateConflictError } from './diary.types'
import { emitDomainMutation } from '../events'

/**
 * 彻底脱离双写架构（Anti-pattern）的正统白守日记统筹层：
 * 日记核心业务服务，组合 Repository 与文件同步以及索引系统的功能。
 *
 * 真正的唯一真相来源（SSOT）只有物理 Markdown 文件体系。
 * 数据库（Shadow Repo）在此仅提供高速查询与全文 FTS 搜索的『影子快照』。
 */
export class DiaryService {
  constructor(
    private readonly shadowRepo: ShadowIndexRepository,
    private readonly fileSync: FileSyncService,
    private readonly shadowSync: ShadowIndexSyncService,
    private readonly vaultIndex: VaultIndexService
  ) {}

  async create(input: CreateDiaryInput): Promise<Diary> {
    // 1. 检查物理文件是否存在：以文件系统为唯一真理
    const existingFile = await this.fileSync.readJournal(input.date)
    if (existingFile) {
      throw new DiaryDateConflictError(input.date)
    }

    // 2. 补全必要的主键和时间戳（对标原版：targetId = id ?? DateTime.now().millisecondsSinceEpoch）
    // 完全摒弃依赖数据库下发 ID 导致的「双写（覆盖写）」问题。
    const now = new Date()
    const finalDiary: Diary = {
      ...input,
      id: (input as any).id ?? Date.now(),
      createdAt: (input as any).createdAt ?? now,
      updatedAt: now,
      isFavorite: input.isFavorite ?? false,
      mediaPaths: input.mediaPaths
        ? typeof input.mediaPaths === 'string'
          ? JSON.parse(input.mediaPaths)
          : input.mediaPaths
        : []
    }

    // 3. 执行单次物理落盘
    await this.fileSync.writeJournal(finalDiary)

    // 4. 同步到 SQLite 影子索引中重建缓存并下发向量任务
    const syncResult = await this.shadowSync.syncJournal(formatLocalDate(input.date))
    if (!syncResult.meta) {
      throw new Error('写入文件后却无法建立影子索引')
    }

    // 5. 更新界面内存索引以供列表呈现
    this.vaultIndex.upsert(syncResult.meta)

    // 确保返回给前端的 ID 始终与数据库实际插入/更新的行 ID 保持强一致（防止脏数据与自增偏离）
    const writtenId = finalDiary.id
    finalDiary.id = syncResult.meta.id
    if (writtenId !== syncResult.meta.id) {
      await this.fileSync.writeJournal(finalDiary)
    }

    emitDomainMutation({ domain: 'diary', action: 'create', entityId: finalDiary.id })
    return finalDiary
  }

  // formatDateString 已移除，全链路统一使用 @baishou/shared 的 formatLocalDate

  async update(id: number, input: UpdateDiaryInput): Promise<Diary> {
    let resolvedId = id
    let existingShadow = await this.shadowRepo.findById(resolvedId)

    const inputDate = input.date
      ? input.date instanceof Date
        ? input.date
        : parseDateStr(String(input.date).split('T')[0]!)
      : undefined

    if (!existingShadow && inputDate) {
      const healedShadow = await this.resolveDiaryShadowForDate(inputDate, resolvedId)
      if (healedShadow) {
        resolvedId = healedShadow.id
        existingShadow = healedShadow
      }
    }

    if (!existingShadow) {
      throw new DiaryNotFoundError(id)
    }

    const sdStr = String(existingShadow.date)
    const existingDateStr = sdStr.split('T')[0]!
    const existingDate = parseDateStr(existingDateStr)

    // 尝试拉出物理正本文件（沿用影子索引中的实际路径，兼容外部 Obsidian 非标准布局）
    const existingDiary = await this.fileSync.readJournal(existingDate, existingShadow.filePath)
    if (!existingDiary) {
      // 如果由于各种奇怪原因，文件被人删了但索引还存留
      throw new DiaryNotFoundError(resolvedId)
    }

    // 确保 input.date 是 Date 对象（前端 IPC 传递可能会变成 string）

    // 比对日期字符串（对齐原版 oldDateStr != fmt.format(date)）
    const oldDateStr = formatLocalDate(existingDate)
    const inputDateStr = inputDate ? formatLocalDate(inputDate) : oldDateStr
    const isDateJumped = inputDateStr !== oldDateStr

    // 检查日期跳转时的覆盖合并
    let conflictId: number | undefined
    if (inputDate && isDateJumped) {
      const conflict = await this.fileSync.readJournal(inputDate)
      if (conflict) {
        this._mergeDiaries(input, conflict)
        conflictId = conflict.id // 保留目标（存量文件）的主键，防止孤儿或者冲撞
      }

      try {
        await this.fileSync.deleteJournalFile(existingDate)
      } catch (e) {
        console.warn('Failed to delete old file during update', e)
      }
    }

    // 模拟数据落盘（此时文件指纹一定会变动）
    const finalId = conflictId || resolvedId
    const mergedDiaryToSave: Diary = {
      ...existingDiary,
      ...input,
      id: finalId,
      updatedAt: new Date()
    }
    if (inputDate) mergedDiaryToSave.date = inputDate
    await this.fileSync.writeJournal(mergedDiaryToSave, existingShadow.filePath)

    // 呼唤影子同步引擎进行更新重算和提取
    // 如果修改了日期，那么目标文件名也变了，要对新的日期发出同步令，对旧日期由于删除了它会自动触发孤立清除
    const targetDate = inputDate ? inputDate : existingDate

    if (inputDate && isDateJumped) {
      await this.shadowSync.syncJournal(existingDateStr) // 这会触发删除旧索引的孤立清理
      this.vaultIndex.remove(resolvedId) // 安全清理防鬼影
    }

    const syncResult = await this.shadowSync.syncJournal(formatLocalDate(targetDate))

    if (syncResult.meta) {
      this.vaultIndex.upsert(syncResult.meta)
      const syncedId = syncResult.meta.id
      if (mergedDiaryToSave.id !== syncedId) {
        mergedDiaryToSave.id = syncedId
        await this.fileSync.writeJournal(mergedDiaryToSave, existingShadow.filePath)
      } else {
        mergedDiaryToSave.id = syncedId
      }
    } else {
      // 预防性清理防止鬼影
      this.vaultIndex.remove(resolvedId)
    }

    emitDomainMutation({ domain: 'diary', action: 'update', entityId: mergedDiaryToSave.id })
    return mergedDiaryToSave
  }

  /**
   * 统一的保存日记接口（支持新建与更新）。
   * 自动处理日期冲突与内容合并，保证桌面端与移动端业务表现一致。
   *
   * @param id - 日记的物理 ID，为 null 时代表新建，不为 null 时代表更新
   * @param input - 日记输入数据
   * @returns 保存/更新/合并后的日记实体
   *
   * @throws {DiaryNotFoundError} 更新模式下如果找不到对应的原日记文件则抛出
   */
  async save(id: number | null, input: CreateDiaryInput & { id?: number }): Promise<Diary> {
    if (id !== null) {
      return this.update(id, input)
    }

    // 新建模式，提取日期
    const inputDate = input.date
      ? input.date instanceof Date
        ? input.date
        : parseDateStr(String(input.date).split('T')[0]!)
      : new Date()

    // 检查此日期是否已经存在日记文件
    const existingDiary = await this.fileSync.readJournal(inputDate)
    if (existingDiary) {
      // 若已存在，则合并内容并做更新
      this._mergeDiaries(input, existingDiary)
      const resolvedId = await this.resolveDiaryIdForDate(inputDate, existingDiary.id)
      if (!resolvedId) {
        throw new DiaryNotFoundError(existingDiary.id ?? 0)
      }
      return this.update(resolvedId, {
        ...input,
        date: inputDate
      })
    }

    // 若无冲突，则创建新日记
    return this.create({
      ...input,
      date: inputDate
    })
  }

  async delete(id: number): Promise<void> {
    const existingShadow = await this.shadowRepo.findById(id)
    if (existingShadow) {
      const existingDateStr = String(existingShadow.date).split('T')[0]!
      const existingDate = parseDateStr(existingDateStr)
      await this.fileSync.deleteJournalFile(existingDate)

      // 触发脏检测将会使其判定为孤立索引并级联删除向量、重置一切缓存
      await this.shadowSync.syncJournal(existingDateStr)

      this.vaultIndex.remove(id)
    }

    emitDomainMutation({ domain: 'diary', action: 'delete', entityId: id })
  }

  async findById(id: number): Promise<Diary | null> {
    const shadow = await this.shadowRepo.findById(id)
    if (!shadow) return null
    const dateStr = String(shadow.date).split('T')[0]!
    const date = parseDateStr(dateStr)

    // HEALING: Lazily trigger sync to heal any out-of-sync local file editing
    this.shadowSync.syncJournal(dateStr).catch((e) => console.warn('Lazy sync failed', e))

    const fromDisk = await this.fileSync.readJournal(date, shadow.filePath)
    if (fromDisk?.content?.trim()) {
      if (!fromDisk.id) fromDisk.id = shadow.id
      return fromDisk
    }

    if (shadow.rawContent?.trim()) {
      return this.buildDiaryFromShadowRow(shadow, date)
    }

    if (fromDisk) {
      if (!fromDisk.id) fromDisk.id = shadow.id
      return fromDisk
    }

    return null
  }

  /**
   * 批量加载日记正文供 RAG 嵌入：优先使用影子索引中的 rawContent，避免逐篇读磁盘。
   */
  async findByIdsForEmbedding(ids: number[]): Promise<Map<number, Diary>> {
    const result = new Map<number, Diary>()
    if (ids.length === 0) return result

    const rows = await this.shadowRepo.findByIds(ids)
    const diskFallbackIds: number[] = []

    for (const shadow of rows) {
      const dateStr = String(shadow.date).split('T')[0]!
      const date = parseDateStr(dateStr)
      if (shadow.rawContent?.trim()) {
        result.set(shadow.id, this.buildDiaryFromShadowRow(shadow, date))
      } else {
        diskFallbackIds.push(shadow.id)
      }
    }

    for (const id of diskFallbackIds) {
      const diary = await this.findById(id)
      if (diary?.id) {
        result.set(id, diary)
      }
    }

    return result
  }

  private buildDiaryFromShadowRow(
    shadow: NonNullable<Awaited<ReturnType<ShadowIndexRepository['findById']>>>,
    date: Date
  ): Diary {
    const tagsSource = shadow.tags ?? ''
    const parsedTags = tagsSource
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    return {
      id: shadow.id,
      date,
      content: shadow.rawContent ?? '',
      tags: parsedTags.length > 0 ? parsedTags.join(',') : undefined,
      tagColors:
        Object.keys(normalizeDiaryTagColorRegistry(shadow.tagColors)).length > 0
          ? normalizeDiaryTagColorRegistry(shadow.tagColors)
          : undefined,
      updatedAt: shadow.updatedAt ? new Date(shadow.updatedAt) : undefined,
      weather: shadow.weather ?? undefined,
      mood: shadow.mood ?? undefined,
      location: shadow.location ?? undefined,
      locationDetail: shadow.locationDetail ?? undefined,
      isFavorite: shadow.isFavorite,
      mediaPaths: []
    }
  }

  /** 批量读取影子索引元数据（不读磁盘日记正文，供搜索列表等场景） */
  async findMetaByIds(ids: number[]): Promise<DiaryMeta[]> {
    if (ids.length === 0) return []
    const rows = await this.shadowRepo.findByIds(ids)
    const rowMap = new Map(rows.map((r) => [r.id, r]))
    return ids
      .map((id) => rowMap.get(id))
      .filter((row): row is NonNullable<typeof row> => row != null)
      .map((row) => this.mapShadowRowToMeta(row))
  }

  async findByDate(date: Date): Promise<Diary | null> {
    const dateStr = formatLocalDate(date)
    const shadow = await this.shadowRepo.findByDate(dateStr)

    // 穿透底层：真相来自物理文件；优先使用影子索引记录的实际路径（外部存储 / Obsidian 布局）
    const diary = await this.fileSync.readJournal(date, shadow?.filePath)

    // 补救机制：如果物理文件遗漏了头部属性的 ID
    if (diary && !diary.id && shadow) {
      diary.id = shadow.id
    }

    // HEALING: Lazily trigger sync to heal any out-of-sync local file editing
    this.shadowSync.syncJournal(dateStr).catch((e) => console.warn('Lazy sync failed', e))

    return diary
  }

  async listAll(options?: { limit?: number; offset?: number }): Promise<DiaryMeta[]> {
    const shadows = await this.shadowRepo.listAllWithFTS(options)
    return shadows.map((s) => this.mapShadowRowToMeta(s))
  }

  async listFiltered(filter: DiaryListFilter = {}): Promise<DiaryMeta[]> {
    const shadows = await this.shadowRepo.listFiltered(filter)
    return shadows.map((s) => this.mapShadowRowToMeta(s))
  }

  async countFiltered(filter: Omit<DiaryListFilter, 'limit' | 'offset'> = {}): Promise<number> {
    return this.shadowRepo.countFiltered(filter)
  }

  async search(
    query: string,
    options?: DiaryListFilter & { limit?: number; offset?: number }
  ): Promise<DiaryMeta[]> {
    const page = await this.searchPage(query, options)
    return page.items
  }

  /**
   * 分页全文搜索：FTS/LIKE 与影子索引一次 JOIN，仅对缺失行批量补 ID。
   * 有天气/收藏等后置筛选时批量扫描 FTS，保证分页正确。
   */
  async searchPage(
    query: string,
    options?: DiaryListFilter & { limit?: number; offset?: number }
  ): Promise<{ items: DiaryMeta[]; hasMore: boolean }> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0
    const { limit: _l, offset: _o, orderBy: _ob, ...filterRest } = options || {}
    const filterOpts = filterRest as Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
    const needCount = offset + limit + 1

    if (!this.hasPostSearchFilter(filterOpts)) {
      const ftsResults = await this.shadowRepo.searchFTS(query, limit + 1, offset)
      const hasMore = ftsResults.length > limit
      const pageHits = ftsResults.slice(0, limit)
      const items = await this.mapFtsHitsToFilteredMetas(pageHits, filterOpts)
      return { items, hasMore }
    }

    const collected: DiaryMeta[] = []
    let ftsOffset = 0
    const batchSize = Math.max(limit * 2, 20)

    while (collected.length < needCount) {
      const batch = await this.shadowRepo.searchFTS(query, batchSize, ftsOffset)
      if (batch.length === 0) break

      const filtered = await this.mapFtsHitsToFilteredMetas(batch, filterOpts)
      collected.push(...filtered)
      ftsOffset += batch.length
    }

    return {
      items: collected.slice(offset, offset + limit),
      hasMore: collected.length > offset + limit
    }
  }

  private hasPostSearchFilter(
    filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
  ): boolean {
    return Boolean(
      filter.favorite ||
      (filter.weathers && filter.weathers.length > 0) ||
      (filter.year != null && filter.month != null)
    )
  }

  private async mapFtsHitsToFilteredMetas(
    hits: Awaited<ReturnType<ShadowIndexRepository['searchFTS']>>,
    filterOpts: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
  ): Promise<DiaryMeta[]> {
    if (hits.length === 0) return []

    const missingIds = hits.filter((h) => !h.indexRow).map((h) => h.rowid)
    const batchRows = missingIds.length > 0 ? await this.shadowRepo.findByIds(missingIds) : []
    const rowMap = new Map(batchRows.map((r) => [r.id, r]))
    for (const hit of hits) {
      if (hit.indexRow) rowMap.set(hit.rowid, hit.indexRow)
    }

    return hits
      .map((hit) => {
        const row = hit.indexRow ?? rowMap.get(hit.rowid)
        if (!row) return null
        const meta = this.mapShadowRowToMeta(row, hit.contentSnippet)
        return this.matchesListFilter(meta, filterOpts) ? meta : null
      })
      .filter((item): item is DiaryMeta => item !== null)
  }

  /** 全文搜索命中总数（不含月份筛选，供日记页跨月搜索分页） */
  async countSearch(
    query: string,
    options?: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
  ): Promise<number> {
    const hasExtraFilter =
      options?.favorite ||
      (options?.weathers && options.weathers.length > 0) ||
      (options?.year != null && options?.month != null)

    if (!hasExtraFilter) {
      return this.shadowRepo.countSearchFTS(query)
    }

    const FILTERED_CAP = 500
    const ftsResults = await this.shadowRepo.searchFTS(query, FILTERED_CAP, 0)
    if (ftsResults.length === 0) return 0

    const ids = ftsResults.filter((h) => !h.indexRow).map((r) => r.rowid)
    const batchRows = ids.length > 0 ? await this.shadowRepo.findByIds(ids) : []
    const rowMap = new Map(batchRows.map((r) => [r.id, r]))
    for (const hit of ftsResults) {
      if (hit.indexRow) rowMap.set(hit.rowid, hit.indexRow)
    }
    const filterOpts = options as Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>

    return ftsResults.filter((hit) => {
      const row = hit.indexRow ?? rowMap.get(hit.rowid)
      if (!row) return false
      const meta = this.mapShadowRowToMeta(row)
      return this.matchesListFilter(meta, filterOpts)
    }).length
  }

  private matchesListFilter(
    meta: DiaryMeta,
    filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
  ): boolean {
    if (filter.year != null && filter.month != null) {
      if (meta.date.getFullYear() !== filter.year || meta.date.getMonth() + 1 !== filter.month) {
        return false
      }
    }
    if (filter.favorite && !meta.isFavorite) return false
    if (filter.weathers && filter.weathers.length > 0) {
      if (!weatherMatchesFilter(meta.weather, filter.weathers)) return false
    }
    return true
  }

  private mapShadowRowToMeta(
    s: {
      id: number
      date: string
      updatedAt: string
      weather: string | null
      mood: string | null
      location: string | null
      isFavorite: boolean
      hasMedia: boolean
      rawContent?: string | null
      tags?: string | null
      tagsStr?: string | null
      tagColors?: string | null
    },
    previewOverride?: string
  ): DiaryMeta {
    const tagsSource = s.tags ?? s.tagsStr ?? ''
    let parsedTags: string[] = []
    if (tagsSource) {
      parsedTags = tagsSource
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean)
    }

    const tagColors = normalizeDiaryTagColorRegistry(s.tagColors)
    const rawContent = s.rawContent ?? ''
    return {
      id: s.id,
      date: parseDateStr(s.date.split('T')[0]!),
      preview: formatDiaryPreviewText(
        previewOverride || (rawContent ? rawContent.substring(0, 500) : '')
      ),
      tags: parsedTags,
      tagColors: Object.keys(tagColors).length > 0 ? tagColors : undefined,
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
      weather: s.weather || undefined,
      mood: s.mood || undefined,
      location: s.location || undefined,
      isFavorite: s.isFavorite || false,
      hasMedia: s.hasMedia || false
    }
  }

  async count(): Promise<number> {
    return this.shadowRepo.count()
  }

  async getActivityData(year?: number): Promise<Array<{ date: string; count: number }>> {
    return this.shadowRepo.getActivityData(year)
  }

  private async resolveDiaryShadowForDate(
    date: Date,
    preferredId?: number | null
  ): Promise<Awaited<ReturnType<ShadowIndexRepository['findByDate']>> | null> {
    if (preferredId) {
      const byId = await this.shadowRepo.findById(preferredId)
      if (byId) return byId
    }

    const dateStr = formatLocalDate(date)
    const byDate = await this.shadowRepo.findByDate(dateStr)
    if (byDate) return byDate

    const syncResult = await this.shadowSync.syncJournal(dateStr)
    if (!syncResult.meta) return null

    return (
      (await this.shadowRepo.findById(syncResult.meta.id)) ??
      (await this.shadowRepo.findByDate(dateStr))
    )
  }

  private async resolveDiaryIdForDate(
    date: Date,
    preferredId?: number | null
  ): Promise<number | null> {
    const shadow = await this.resolveDiaryShadowForDate(date, preferredId)
    return shadow?.id ?? null
  }

  /**
   * SOLID: 单一职责，处理由于日期飞跃造成的覆盖冲撞时，对文本和内部属性的安全合并
   * @param source 正在迁移的原件更新负荷
   * @param target 目标日期的驻留文件体
   */
  private _mergeDiaries(source: UpdateDiaryInput, target: Diary): void {
    const oldContent = (target.content || '').trimEnd()
    const newContent = (source.content || '').trimEnd()

    // 合流机制：如果目标已有内容，用两个空行追加。
    source.content = oldContent ? `${oldContent}\n\n${newContent}` : newContent

    // 标签去重归并
    const mergedTags = new Set<string>()
    const parseTags = (t: any): string[] => {
      if (!t) return []
      if (Array.isArray(t)) return t
      if (typeof t === 'string')
        return t
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      return []
    }

    parseTags(target.tags).forEach((t) => mergedTags.add(t))
    parseTags(source.tags).forEach((t) => mergedTags.add(t))
    source.tags = Array.from(mergedTags).join(',')

    const mergedTagColors = mergeDiaryTagColorRegistries(
      normalizeDiaryTagColorRegistry(target.tagColors),
      normalizeDiaryTagColorRegistry(source.tagColors)
    )
    source.tagColors =
      Object.keys(mergedTagColors).length > 0 ? mergedTagColors : undefined

    // 其他必要元数据如果有丢失则补充
    source.weather = source.weather ?? target.weather
    source.mood = source.mood ?? target.mood
    source.location = source.location ?? target.location
    source.locationDetail = source.locationDetail ?? target.locationDetail
    source.isFavorite = source.isFavorite ?? target.isFavorite
  }
}
