import { DiaryRepository } from '@baishou/database';
import { CreateDiaryInput, Diary, DiarySchema } from '@baishou/shared';

export class DiaryService {
  constructor(private readonly diaryRepo: DiaryRepository) {}

  async createDiary(input: CreateDiaryInput): Promise<Diary> {
    // 使用 Zod 对业务输入进行校验
    const CreateSchema = DiarySchema.omit({ id: true, createdAt: true, updatedAt: true });
    const parsed = CreateSchema.parse(input);
    
    // 入库
    return await this.diaryRepo.create(parsed);
  }

  async getDiary(id: number): Promise<Diary | null> {
    return await this.diaryRepo.findById(id);
  }
}
