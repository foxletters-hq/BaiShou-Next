import { sql, eq, between } from 'drizzle-orm';
import { diariesTable } from '../schema/diaries';
import { DiaryRepository } from './diary.repository';
import { CreateDiaryInput, UpdateDiaryInput, Diary } from '@baishou/shared';

export class DiaryNotFoundError extends Error {
  constructor(id: number) {
    super(`Diary with ID ${id} not found.`);
    this.name = 'DiaryNotFoundError';
  }
}

export class DiaryDateConflictError extends Error {
  constructor(date: Date) {
    super(`Diary for date ${date.toISOString()} already exists.`);
    this.name = 'DiaryDateConflictError';
  }
}

import { AppDatabase } from '../types';

export class DiaryRepositoryImpl implements DiaryRepository {
  constructor(private readonly db: AppDatabase) {}

  private mapToDiary(row: any): Diary {
    return {
      ...row,
      mediaPaths: (row.mediaPaths as string[]) || []
    };
  }

  async findById(id: number): Promise<Diary | null> {
    const result = await this.db.select().from(diariesTable).where(eq(diariesTable.id, id)).get();
    return result ? this.mapToDiary(result) : null;
  }

  async findByDate(date: Date): Promise<Diary | null> {
    const result = await this.db.select().from(diariesTable).where(eq(diariesTable.date, date)).get();
    return result ? this.mapToDiary(result) : null;
  }

  async findByDateRange(start: Date, end: Date): Promise<Diary[]> {
    const results = await this.db.select().from(diariesTable).where(between(diariesTable.date, start, end)).all();
    return results.map(this.mapToDiary);
  }

  async create(diaryInput: CreateDiaryInput): Promise<Diary> {
    const existing = await this.findByDate(diaryInput.date);
    if (existing) {
      throw new DiaryDateConflictError(diaryInput.date);
    }

    const inserted = await this.db.insert(diariesTable).values({
      date: diaryInput.date,
      content: diaryInput.content,
      tags: diaryInput.tags,
      weather: diaryInput.weather,
      mood: diaryInput.mood,
      location: diaryInput.location,
      locationDetail: diaryInput.locationDetail,
      isFavorite: diaryInput.isFavorite,
      mediaPaths: diaryInput.mediaPaths
    }).returning().get();

    return this.mapToDiary(inserted);
  }

  async update(id: number, diaryInput: UpdateDiaryInput): Promise<Diary> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new DiaryNotFoundError(id);
    }

    if (diaryInput.date && diaryInput.date.getTime() !== existing.date.getTime()) {
      const conflict = await this.findByDate(diaryInput.date);
      if (conflict) {
        throw new DiaryDateConflictError(diaryInput.date);
      }
    }

    const updated = await this.db.update(diariesTable).set({
      ...diaryInput,
      updatedAt: new Date()
    }).where(eq(diariesTable.id, id)).returning().get();

    return this.mapToDiary(updated);
  }

  async delete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new DiaryNotFoundError(id);
    }

    await this.db.delete(diariesTable).where(eq(diariesTable.id, id)).run();
  }

  async search(query: string, options: { limit?: number; offset?: number; } = {}): Promise<Diary[]> {
    const results = await this.db.select().from(diariesTable)
      .where(sql`content LIKE ${'%' + query + '%'}`)
      .limit(options.limit || 20)
      .offset(options.offset || 0)
      .all();
    return results.map(row => this.mapToDiary(row));
  }

  async list(options: { limit?: number; offset?: number; orderBy?: 'asc' | 'desc' } = {}): Promise<Diary[]> {
    const orderFn = options.orderBy === 'asc' ? sql`${diariesTable.date} ASC` : sql`${diariesTable.date} DESC`;
    const results = await this.db.select().from(diariesTable)
      .orderBy(orderFn)
      .limit(options.limit || 20)
      .offset(options.offset || 0)
      .all();
    return results.map(row => this.mapToDiary(row));
  }
}


