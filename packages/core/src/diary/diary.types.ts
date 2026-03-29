export interface CreateDiaryInput {
  date: Date;
  content: string;
  tags?: string;
  weather?: string;
  mood?: string;
  location?: string;
  locationDetail?: string;
  isFavorite?: boolean;
  mediaPaths?: string; // JSON Array stored as string
}

export interface UpdateDiaryInput extends Partial<CreateDiaryInput> {}

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

export interface IDiaryRepository {
  findById(id: number): Promise<any | null>;
  findByDate(date: Date): Promise<any | null>;
  findByDateRange(start: Date, end: Date): Promise<any[]>;
  create(diary: CreateDiaryInput): Promise<any>;
  update(id: number, diary: UpdateDiaryInput): Promise<any>;
  delete(id: number): Promise<void>;
  search(query: string, limit?: number): Promise<any[]>;
}
