import { DiaryRepository } from '@baishou/database';
import { Diary, CreateDiaryInput, UpdateDiaryInput } from '@baishou/shared';

export class MockDiaryRepository implements DiaryRepository {
  private diaries: Diary[] = [];
  private nextId = 1;

  async findById(id: number): Promise<Diary | null> {
    return this.diaries.find(d => d.id === id) || null;
  }
  
  async findByDate(date: Date): Promise<Diary | null> {
    return this.diaries.find(d => d.date.getTime() === date.getTime()) || null;
  }
  
  async findByDateRange(start: Date, end: Date): Promise<Diary[]> {
    return this.diaries.filter(d => d.date >= start && d.date <= end);
  }
  
  async create(input: CreateDiaryInput): Promise<Diary> {
    const newDiary: Diary = {
      isFavorite: false,
      mediaPaths: [],
      ...input,
      id: this.nextId++,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.diaries.push(newDiary);
    return newDiary;
  }
  
  async update(id: number, input: UpdateDiaryInput): Promise<Diary> {
    const idx = this.diaries.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('Not found');
    this.diaries[idx] = { ...this.diaries[idx]!, ...input, updatedAt: new Date() };
    return this.diaries[idx]!;
  }
  
  async delete(id: number): Promise<void> {
    this.diaries = this.diaries.filter(d => d.id !== id);
  }
  
  async search(query: string): Promise<Diary[]> {
    return this.diaries.filter(d => d.content.includes(query));
  }
}
