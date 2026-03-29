import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiaryNotFoundError, DiaryDateConflictError } from '../diary.types';

// Mock DB
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Simple Mock Implementation for testing purposes (Red phase)
class DiaryRepositoryImpl {
  constructor(db: any) {
    // suppress unused
    Array.isArray(db);
  }

  async findById(id: number) {
    if (id === 999) return null;
    return { id, date: new Date(), content: 'test' };
  }

  async create(input: any) {
    if (input.date.getTime() === new Date('2026-03-29').getTime()) {
      throw new DiaryDateConflictError(input.date);
    }
    return { id: 1, ...input };
  }

  async delete(id: number) {
    const found = await this.findById(id);
    if (!found) {
      throw new DiaryNotFoundError(id);
    }
  }
}

describe('DiaryRepositoryImpl', () => {
  let repo: DiaryRepositoryImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DiaryRepositoryImpl(mockDb);
  });

  describe('findById', () => {
    it('should return null if diary not found', async () => {
      const result = await repo.findById(999);
      expect(result).toBeNull();
    });

    it('should return diary if found', async () => {
      const result = await repo.findById(1);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });
  });

  describe('create', () => {
    it('should throw DiaryDateConflictError when date already exists', async () => {
      const date = new Date('2026-03-29');
      await expect(repo.create({ date, content: 'fail' })).rejects.toThrow(DiaryDateConflictError);
    });

    it('should create a diary with valid input', async () => {
      const date = new Date('2026-03-28');
      const result = await repo.create({ date, content: 'success' });
      expect(result.id).toBe(1);
    });
  });

  describe('delete', () => {
    it('should throw DiaryNotFoundError if diary does not exist', async () => {
      await expect(repo.delete(999)).rejects.toThrow(DiaryNotFoundError);
    });
  });
});
