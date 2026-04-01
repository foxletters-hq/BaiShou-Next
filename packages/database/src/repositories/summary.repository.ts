import { Summary, CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared';

export interface SummaryRepository {
  save(summary: CreateSummaryInput): Promise<Summary>;
  upsert(summary: CreateSummaryInput): Promise<Summary>;
  update(id: number, summary: UpdateSummaryInput): Promise<Summary>;
  getByDateRange(type: SummaryType, start: Date, end: Date): Promise<Summary | null>;
  getSummaries(options?: { start?: Date }): Promise<Summary[]>;
  delete(id: number): Promise<void>;
  deleteAll(): Promise<void>;
}
