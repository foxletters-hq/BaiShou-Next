import {
  Summary,
  CreateSummaryInput,
  UpdateSummaryInput,
  SummaryType,
  formatLocalDate
} from '@baishou/shared'
import { SummarySyncService } from './summary-sync.service'
import { SummaryFileService } from '../vault/summary-file.service'
import { SummaryRepository } from '@baishou/database'
import { emitDomainMutation } from '../events'

/** 文件存在但 DB 未入库时的稳定负向占位 id（避免多条撞成 0） */
export function ghostSummaryId(type: SummaryType | string, startDate: Date): number {
  const key = `${type}:${formatLocalDate(startDate)}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  const id = -Math.abs(hash)
  return id === 0 ? -1 : id
}

export class SummaryManagerService {
  constructor(
    private readonly summaryRepo: SummaryRepository,
    private readonly fileSync: SummaryFileService,
    private readonly summarySync: SummarySyncService
  ) {}

  async save(input: CreateSummaryInput): Promise<Summary> {
    // 1. 写文件 (真相源泉 SSOT 落盘)
    await this.fileSync.writeSummary(input.type, input.startDate, input.content)

    // 2. 触发脏检测与单向入库缓存
    await this.summarySync.syncSummaryFile(input.type, input.startDate, input.endDate)

    // 3. 从只读的摘要缓存库返回
    const dbRecord = await this.summaryRepo.getByDateRange(
      input.type,
      input.startDate,
      input.endDate
    )
    if (!dbRecord) {
      throw new Error('SummarySync failed to materialize record in DB')
    }
    emitDomainMutation({
      domain: 'summary',
      action: 'create',
      entityId: dbRecord.id,
      meta: { type: input.type }
    })
    return dbRecord
  }

  async update(
    _id: number,
    type: SummaryType,
    startDate: Date,
    endDate: Date,
    update: UpdateSummaryInput
  ): Promise<Summary> {
    const existing = await this.summaryRepo.getByDateRange(type, startDate, endDate)
    const fileContent = await this.fileSync.readSummary(type, startDate)
    if (!existing && fileContent == null) {
      throw new Error(`Summary not found for ${type}`)
    }

    const newContent = update.content ?? existing?.content ?? fileContent ?? ''

    await this.fileSync.writeSummary(type, startDate, newContent)
    await this.summarySync.syncSummaryFile(type, startDate, endDate)

    const updated = await this.summaryRepo.getByDateRange(type, startDate, endDate)
    emitDomainMutation({
      domain: 'summary',
      action: 'update',
      entityId: updated?.id ?? existing?.id,
      meta: { type }
    })
    if (updated) return updated

    return {
      id: existing?.id ?? ghostSummaryId(type, startDate),
      type,
      startDate,
      endDate,
      content: newContent,
      sourceIds: existing?.sourceIds ?? null,
      generatedAt: existing?.generatedAt ?? new Date()
    }
  }

  async readDetail(type: SummaryType, startDate: Date, endDate: Date): Promise<Summary | null> {
    // 读取详情时，优先穿透到文件获得最新鲜正本（哪怕它没有被 sync）
    const content = await this.fileSync.readSummary(type, startDate)
    if (!content) return null

    // 获取缓存记录的 ID 或其他生成属性
    const dbRecord = await this.summaryRepo.getByDateRange(type, startDate, endDate)
    if (dbRecord) {
      return { ...dbRecord, content }
    }

    // Fallback，文件存在但 DB 不存在（可能因为没 sync）
    return {
      id: ghostSummaryId(type, startDate),
      type,
      startDate,
      endDate,
      content,
      generatedAt: new Date()
    }
  }

  async list(options?: { start?: Date }): Promise<Summary[]> {
    const files = await this.fileSync.listAllSummaries()
    const filtered = options?.start
      ? files.filter((file) => file.startDate >= options.start!)
      : files

    const summaries = await Promise.all(
      filtered.map(async (file) => {
        const dbRecord = await this.summaryRepo.getByDateRange(
          file.type,
          file.startDate,
          file.endDate
        )
        const fileContent = await this.fileSync.readSummary(file.type, file.startDate)
        const content = fileContent ?? dbRecord?.content ?? ''
        return {
          ...(dbRecord ?? {
            id: ghostSummaryId(file.type, file.startDate),
            generatedAt: new Date()
          }),
          type: file.type,
          startDate: file.startDate,
          endDate: file.endDate,
          content
        } as Summary
      })
    )

    return summaries.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
  }

  /**
   * 画廊列表：文件索引 + 单次 DB 批量查询。
   * DB 已有正文时不读盘；仅当文件在盘、DB 无正文时按需读盘（共同回忆/预览一致性）。
   */
  async listForGallery(options?: { start?: Date; endAfter?: Date }): Promise<Summary[]> {
    const files = await this.fileSync.listAllSummaries()
    let filtered = files
    if (options?.start) {
      filtered = filtered.filter((file) => file.startDate >= options.start!)
    }
    if (options?.endAfter) {
      filtered = filtered.filter((file) => file.endDate > options.endAfter!)
    }

    const dbRecords = await this.summaryRepo.getSummaries(
      options?.start ? { start: options.start } : undefined
    )
    const dbByKey = new Map<string, Summary>()
    for (const record of dbRecords) {
      const start =
        record.startDate instanceof Date ? record.startDate : new Date(record.startDate)
      dbByKey.set(`${record.type}:${start.getTime()}`, record)
    }

    const summaries = await Promise.all(
      filtered.map(async (file) => {
        const dbRecord = dbByKey.get(`${file.type}:${file.startDate.getTime()}`)
        let content = dbRecord?.content ?? ''
        if (!content.trim()) {
          content = (await this.fileSync.readSummary(file.type, file.startDate)) ?? ''
        }
        return {
          ...(dbRecord ?? {
            id: ghostSummaryId(file.type, file.startDate),
            generatedAt: new Date()
          }),
          type: file.type,
          startDate: file.startDate,
          endDate: file.endDate,
          content
        } as Summary
      })
    )

    return summaries.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
  }

  /** 统计面板：按当前工作区磁盘上的总结文件计数，与画廊列表口径一致 */
  async countByType(): Promise<{
    weekly: number
    monthly: number
    quarterly: number
    yearly: number
  }> {
    const files = await this.fileSync.listAllSummaries()
    const counts = {
      weekly: 0,
      monthly: 0,
      quarterly: 0,
      yearly: 0
    }
    for (const file of files) {
      switch (file.type) {
        case SummaryType.weekly:
          counts.weekly += 1
          break
        case SummaryType.monthly:
          counts.monthly += 1
          break
        case SummaryType.quarterly:
          counts.quarterly += 1
          break
        case SummaryType.yearly:
          counts.yearly += 1
          break
      }
    }
    return counts
  }

  async delete(type: SummaryType, startDate: Date, endDate: Date): Promise<void> {
    await this.fileSync.deleteSummary(type, startDate)
    await this.summarySync.syncSummaryFile(type, startDate, endDate) // 孤立检测将会自动删之
    emitDomainMutation({ domain: 'summary', action: 'delete', meta: { type } })
  }
}
