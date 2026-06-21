import { Summary, CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared'
import { SummarySyncService } from './summary-sync.service'
import { SummaryFileService } from '../vault/summary-file.service'
import { SummaryRepository } from '@baishou/database'
import { emitDomainMutation } from '../events'

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
    // 我们必须保证有 content 更新才能重写。对于其他可能的字段我们暂时忽略或如果它只是基于库的字段也应走全管线
    const existing = await this.summaryRepo.getByDateRange(type, startDate, endDate)
    if (!existing) throw new Error(`Summary not found for ${type}`)

    const newContent = update.content ?? existing.content

    await this.fileSync.writeSummary(type, startDate, newContent)
    await this.summarySync.syncSummaryFile(type, startDate, endDate)

    const updated = await this.summaryRepo.getByDateRange(type, startDate, endDate)
    emitDomainMutation({
      domain: 'summary',
      action: 'update',
      entityId: updated?.id,
      meta: { type }
    })
    return updated!
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
      id: 0,
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
      filtered.map(async (file, index) => {
        const content = await this.fileSync.readSummary(file.type, file.startDate)
        const dbRecord = await this.summaryRepo.getByDateRange(
          file.type,
          file.startDate,
          file.endDate
        )
        return {
          ...(dbRecord ?? {
            id: -(index + 1),
            generatedAt: new Date()
          }),
          type: file.type,
          startDate: file.startDate,
          endDate: file.endDate,
          content: content ?? dbRecord?.content ?? ''
        } as Summary
      })
    )

    return summaries.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
  }

  /** 统计面板：仅 SQL 聚合，不读磁盘总结正文 */
  async countByType(): Promise<{
    weekly: number
    monthly: number
    quarterly: number
    yearly: number
  }> {
    const counts = await this.summaryRepo.countByType()
    return {
      weekly: counts.weekly ?? 0,
      monthly: counts.monthly ?? 0,
      quarterly: counts.quarterly ?? 0,
      yearly: counts.yearly ?? 0
    }
  }

  async delete(type: SummaryType, startDate: Date, endDate: Date): Promise<void> {
    await this.fileSync.deleteSummary(type, startDate)
    await this.summarySync.syncSummaryFile(type, startDate, endDate) // 孤立检测将会自动删之
    emitDomainMutation({ domain: 'summary', action: 'delete', meta: { type } })
  }
}
