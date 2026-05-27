import { CreateDiaryInput, UpdateDiaryInput, Diary } from '@baishou/shared'

export interface SearchOptions {
  limit?: number
  offset?: number
}

export interface CursorOptions {
  dateCursor: Date
  idCursor: number
  limit?: number
}

/** 只读查询能力（ISP） */
export interface DiaryReadable {
  findById(id: number): Promise<Diary | null>
  findByDate(date: Date): Promise<Diary | null>
  findByDateRange(start: Date, end: Date): Promise<Diary[]>
  list(options?: { limit?: number; offset?: number; orderBy?: 'asc' | 'desc' }): Promise<Diary[]>
  count(): Promise<number>
  getOldestDiaryDate(): Promise<Date | null>
  getDiariesAfter(cursor: CursorOptions): Promise<Diary[]>
}

/** 写入与删除能力（ISP） */
export interface DiaryWritable {
  create(diary: CreateDiaryInput): Promise<Diary>
  batchCreate(diaries: CreateDiaryInput[]): Promise<Diary[]>
  update(id: number, diary: UpdateDiaryInput): Promise<Diary>
  delete(id: number): Promise<void>
  deleteAll(): Promise<void>
}

/** 搜索能力（ISP） */
export interface DiarySearchable {
  search(query: string, options?: SearchOptions): Promise<Diary[]>
}

/** 完整日记仓库：组合只读、写入与搜索接口 */
export interface DiaryRepository extends DiaryReadable, DiaryWritable, DiarySearchable {}
