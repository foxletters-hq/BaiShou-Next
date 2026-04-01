import { CreateDiaryInput, UpdateDiaryInput, Diary } from '@baishou/shared';

export interface SearchOptions {
  limit?: number;
  offset?: number;
}

export interface CursorOptions {
  dateCursor: Date;
  idCursor: number;
  limit?: number;
}

export interface DiaryRepository {
  findById(id: number): Promise<Diary | null>;
  findByDate(date: Date): Promise<Diary | null>;
  findByDateRange(start: Date, end: Date): Promise<Diary[]>;
  create(diary: CreateDiaryInput): Promise<Diary>;
  batchCreate(diaries: CreateDiaryInput[]): Promise<Diary[]>;
  update(id: number, diary: UpdateDiaryInput): Promise<Diary>;
  delete(id: number): Promise<void>;
  deleteAll(): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<Diary[]>;
  list(options?: { limit?: number; offset?: number; orderBy?: 'asc' | 'desc' }): Promise<Diary[]>;
  count(): Promise<number>;
  getOldestDiaryDate(): Promise<Date | null>;
  getDiariesAfter(cursor: CursorOptions): Promise<Diary[]>;
}
