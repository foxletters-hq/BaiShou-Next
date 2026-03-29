import { describe, it, expect, vi } from 'vitest';
import { EmbeddingService } from '../embedding.service';
import { EmbeddingModel } from 'ai';

// Mock Vercel AI SDK 的 embed 功能
vi.mock('ai', () => ({
  embed: vi.fn().mockImplementation(async () => {
    // 简单地模拟：只要传了字，就返回一个假的假特征向量
    return { embedding: [0.1, 0.2, 0.3], usage: { tokens: 5 } };
  }),
}));

describe('EmbeddingService', () => {
  const mockModel: EmbeddingModel<string> = {
    specificationVersion: 'v1',
    provider: 'openai.mock',
    modelId: 'text-embedding-3-small',
    maxEmbeddingsPerCall: 1,
    supportsParallelCalls: true,
    doEmbed: async () => ({ embeddings: [[0.1, 0.2, 0.3]], usage: { tokens: 5 } }),
  };

  it('should generate valid float array for text', async () => {
    const service = new EmbeddingService(mockModel);
    const result = await service.generateEmbedding('hello world');
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('should throw error on empty string', async () => {
    const service = new EmbeddingService(mockModel);
    await expect(service.generateEmbedding('')).rejects.toThrow('empty string');
    await expect(service.generateEmbedding('   ')).rejects.toThrow('empty string');
  });
});
