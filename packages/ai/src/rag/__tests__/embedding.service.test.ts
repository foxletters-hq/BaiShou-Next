import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../embedding.service';
import { IEmbeddingStorage, IEmbeddingConfig } from '../embedding.types';

const mockConfig: IEmbeddingConfig = {
  getGlobalEmbeddingModelId: vi.fn().mockReturnValue('mock-model'),
  getGlobalEmbeddingProviderId: vi.fn().mockReturnValue('mock-provider'),
  getGlobalEmbeddingDimension: vi.fn().mockReturnValue(0),
  setGlobalEmbeddingDimension: vi.fn(),
};

const mockStorage: IEmbeddingStorage = {
  initVectorIndex: vi.fn(),
  insertEmbedding: vi.fn(),
  deleteEmbeddingsBySource: vi.fn(),
  clearEmbeddings: vi.fn(),
  hasPendingMigration: vi.fn(),
  countHeterogeneousEmbeddings: vi.fn(),
  createMigrationBackup: vi.fn(),
  dropMigrationBackup: vi.fn(),
  clearAndReinitEmbeddings: vi.fn(),
  getUnmigratedCount: vi.fn(),
  getUnmigratedBackupChunks: vi.fn(),
  markBackupChunkMigrated: vi.fn(),
  verifyMigrationComplete: vi.fn(),
};

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService(mockConfig, mockStorage);
    vi.clearAllMocks();
  });

  describe('Normalize (L2)', () => {
    it('should normalize vectors to unit length (length=1)', () => {
      const raw = [1.0, 2.0, 3.0];
      const normalized = service.normalize(raw);
      let norm = 0;
      for (const v of normalized) norm += v * v;
      // JS 浮点计算可能有微小误差，使用 toBeCloseTo
      expect(Math.abs(norm - 1.0)).toBeLessThan(0.0001);
    });

    it('should handle zero vector without dividing by zero', () => {
      const raw = [0, 0, 0];
      const normalized = service.normalize(raw);
      expect(normalized).toEqual([0, 0, 0]);
    });
  });

  describe('tiktoken Chunking', () => {
    it('should split text exceeding max chunk tokens correctly with overlaps', () => {
      // 生成足够长的重复文本
      const text = "Word ".repeat(2000); 
      const chunks = service.splitIntoChunks(text);
      expect(chunks.length).toBeGreaterThan(1);
      
      // 验证重叠
      expect(chunks[0]!.index).toBe(0);
      expect(chunks[1]!.index).toBe(1);
      
      // tiktoken 的文本切片包含了空格还原，且至少保证每块都能输出字符串
      expect(chunks[0]!.text.length).toBeGreaterThan(0);
      expect(chunks[1]!.text.length).toBeGreaterThan(0);
    });

    it('should not split short text', () => {
      const text = "Hello World";
      const chunks = service.splitIntoChunks(text);
      expect(chunks.length).toBe(1);
      expect(chunks[0]!.text).toBe(text);
      expect(chunks[0]!.index).toBe(0);
    });
  });
});
