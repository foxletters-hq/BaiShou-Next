import { describe, it, expect, beforeEach } from 'vitest';
import { DiaryService } from '../services/diary.service';
import { MockDiaryRepository } from './mock.diary-repository';

describe('DiaryService', () => {
  let service: DiaryService;
  let mockRepo: MockDiaryRepository;

  beforeEach(() => {
    mockRepo = new MockDiaryRepository();
    service = new DiaryService(mockRepo);
  });

  it('should successfully create a diary when input is valid', async () => {
    const input = {
      date: new Date(),
      content: 'A fantastic day',
      tags: 'happy'
    };
    
    const result = await service.createDiary(input);
    
    expect(result.id).toBeDefined();
    expect(result.content).toBe('A fantastic day');
    
    const fetched = await service.getDiary(result.id!);
    expect(fetched).toEqual(result);
  });

  it('should throw an error (Zod) when content is empty', async () => {
    const input = {
      date: new Date(),
      content: '', // invalid content block
      tags: ''
    };
    
    await expect(service.createDiary(input)).rejects.toThrow();
  });
});
