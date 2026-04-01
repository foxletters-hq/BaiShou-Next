import { Summary, CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared';
import { SummaryRepository } from './summary.repository';
import { summariesTable } from '../schema/summaries';
import { eq, and, gte } from 'drizzle-orm';
import { AppDatabase } from '../types';

export class SummaryRepositoryImpl implements SummaryRepository {
  constructor(private readonly db: AppDatabase) {}
  async save(summary: CreateSummaryInput): Promise<Summary> {
    const result = await this.db.insert(summariesTable).values({
      type: summary.type,
      startDate: summary.startDate,
      endDate: summary.endDate,
      content: summary.content,
      sourceIds: summary.sourceIds ?? null
    }).returning();
    
    return result[0] as unknown as Summary;
  }

  async upsert(summary: CreateSummaryInput): Promise<Summary> {
    const result = await this.db.insert(summariesTable)
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
      .returning();
    return result[0] as unknown as Summary;
  }

  async update(id: number, summary: UpdateSummaryInput): Promise<Summary> {
    const result = await this.db
      .update(summariesTable)
      .set({
        ...summary,
        // map optional undefined properties as valid undefined for partial update
      })
      .where(eq(summariesTable.id, id))
      .returning();

    if (!result.length) {
      throw new Error(`Summary with id ${id} not found.`);
    }

    return result[0] as unknown as Summary;
  }

  async getByDateRange(type: SummaryType, start: Date, end: Date): Promise<Summary | null> {
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
      .limit(1);

    return (result[0] as unknown as Summary) ?? null;
  }

  async getSummaries(options?: { start?: Date }): Promise<Summary[]> {
    let query = this.db.select().from(summariesTable).$dynamic();

    if (options?.start) {
      query = query.where(gte(summariesTable.startDate, options.start));
    }

    const rows = await query;
    return rows as unknown as Summary[];
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(summariesTable).where(eq(summariesTable.id, id));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(summariesTable);
  }
}
