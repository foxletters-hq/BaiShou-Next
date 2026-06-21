import { Summary, CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared'
import { SummaryRepository } from './summary.repository'
import { summariesTable } from '../schema/summaries'
import { eq, and, gte, sql } from 'drizzle-orm'
import { AppDatabase } from '../types'
import { withExpoAgentDatabaseLock } from '../expo-agent-db.lock'

export class SummaryRepositoryImpl implements SummaryRepository {
  constructor(private readonly db: AppDatabase) {}

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return withExpoAgentDatabaseLock(this.db, fn)
  }

  async save(summary: CreateSummaryInput): Promise<Summary> {
    return this.run(async () => {
      const result = await this.db
        .insert(summariesTable)
        .values({
          type: summary.type,
          startDate: summary.startDate,
          endDate: summary.endDate,
          content: summary.content,
          sourceIds: summary.sourceIds ?? null
        })
        .returning()

      return result[0] as unknown as Summary
    })
  }

  async upsert(summary: CreateSummaryInput): Promise<Summary> {
    return this.run(async () => {
      const result = await this.db
        .insert(summariesTable)
        .values({
          type: summary.type,
          startDate: summary.startDate,
          endDate: summary.endDate,
          content: summary.content,
          sourceIds: summary.sourceIds ?? null
        })
        .onConflictDoUpdate({
          target: [summariesTable.type, summariesTable.startDate, summariesTable.endDate],
          set: { content: summary.content, sourceIds: summary.sourceIds ?? null }
        })
        .returning()
      return result[0] as unknown as Summary
    })
  }

  async update(id: number, summary: UpdateSummaryInput): Promise<Summary> {
    return this.run(async () => {
      const result = await this.db
        .update(summariesTable)
        .set({
          ...summary
          // map optional undefined properties as valid undefined for partial update
        })
        .where(eq(summariesTable.id, id))
        .returning()

      if (!result.length) {
        throw new Error(`Summary with id ${id} not found.`)
      }

      return result[0] as unknown as Summary
    })
  }

  async getByDateRange(type: SummaryType, start: Date, end: Date): Promise<Summary | null> {
    return this.run(async () => {
      const result = await this.db
        .select()
        .from(summariesTable)
        .where(
          and(
            eq(summariesTable.type, type),
            eq(summariesTable.startDate, start),
            eq(summariesTable.endDate, end)
          )
        )
        .limit(1)

      return (result[0] as unknown as Summary) ?? null
    })
  }

  async getSummaries(options?: { start?: Date }): Promise<Summary[]> {
    return this.run(async () => {
      let query = this.db.select().from(summariesTable).$dynamic()

      if (options?.start) {
        query = query.where(gte(summariesTable.startDate, options.start))
      }

      const rows = await query
      return rows as unknown as Summary[]
    })
  }

  async countByType(): Promise<Partial<Record<SummaryType, number>>> {
    return this.run(async () => {
      const rows = await this.db
        .select({
          type: summariesTable.type,
          count: sql<number>`count(*)`
        })
        .from(summariesTable)
        .groupBy(summariesTable.type)

      const result: Partial<Record<SummaryType, number>> = {}
      for (const row of rows) {
        result[row.type as SummaryType] = Number(row.count) || 0
      }
      return result
    })
  }

  async delete(id: number): Promise<void> {
    return this.run(async () => {
      await this.db.delete(summariesTable).where(eq(summariesTable.id, id))
    })
  }

  async deleteAll(): Promise<void> {
    return this.run(async () => {
      await this.db.delete(summariesTable)
    })
  }
}
