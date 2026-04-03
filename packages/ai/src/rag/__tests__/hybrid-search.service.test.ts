import { describe, it, expect, vi } from 'vitest';
import { HybridSearchService } from '../hybrid-search.service';
import { IHybridSearchStorage, ISearchResult } from '../hybrid-search.types';
import { IEmbeddingConfig } from '../embedding.types';

describe('HybridSearchService RRF Engine', () => {
  function createMockConfig(): IEmbeddingConfig {
    return {
      getGlobalEmbeddingModelId: () => 'mock-model',
      getGlobalEmbeddingProviderId: () => 'mock-provider',
      getGlobalEmbeddingDimension: () => 384,
      setGlobalEmbeddingDimension: vi.fn(),
    };
  }

  it('should correctly fuse and re-rank results using Reciprocal Rank Fusion formula', async () => {
    const mockStorage: IHybridSearchStorage = {
      supportsNativeVectorSearch: () => true,

      queryFTS: vi.fn().mockResolvedValue([
        // FTS 结果：d-3 是 FTS #1 (rank=0), d-1 是 FTS #2 (rank=1)
        { messageId: 'd-3', sessionId: 's1', chunkText: '山上的风很大', score: 50, source: 'fts' },
        { messageId: 'd-1', sessionId: 's1', chunkText: '今天非常开心去爬山', score: 10, source: 'fts' },
      ] as ISearchResult[]),

      queryNativeVector: vi.fn().mockResolvedValue([
        // Vector 结果：d-1 是 Vec #1, d-2 是 Vec #2, d-3 是 Vec #3
        { messageId: 'd-1', sessionId: 's1', chunkText: '今天非常开心去爬山', score: 0.9, source: 'vector' },
        { messageId: 'd-2', sessionId: 's1', chunkText: '开心吃大餐', score: 0.7, source: 'vector' },
        { messageId: 'd-3', sessionId: 's1', chunkText: '山上的风很大', score: 0.5, source: 'vector' },
      ] as ISearchResult[]),

      fetchAllEmbeddingsForDecoupledSearch: vi.fn().mockResolvedValue([]),
    };

    const service = new HybridSearchService(mockStorage, createMockConfig());

    const results = await service.search({
      queryText: '山',
      queryVector: [0.1, 0.2],
      topK: 20,
    });

    // RRF 融合算法中，vectorScore = r.score * vectorWeight，ftsScore = ftsWeight / (rank + K)
    // 因此 Vector 原始分数高的条目优势巨大。
    // d-1: ftsScore=0.3/61≈0.00492, vectorScore=0.9*0.7=0.63 → total≈0.635
    // d-2: ftsScore=0,              vectorScore=0.7*0.7=0.49 → total=0.49
    // d-3: ftsScore=0.3/60=0.005,   vectorScore=0.5*0.7=0.35 → total≈0.355
    // 排序：d-1 > d-2 > d-3
    expect(results.length).toBe(3);
    expect(results[0]?.messageId).toBe('d-1');
    expect(results[1]?.messageId).toBe('d-2');
    expect(results[2]?.messageId).toBe('d-3');

    // d-1 同时出现在两个列表中，应该标记为 hybrid
    expect(results[0]?.source).toBe('hybrid');

    // d-2 仅出现在 vector
    expect(results[1]?.source).toBe('vector');

    // d-3 同时出现在两个列表中
    expect(results[2]?.source).toBe('hybrid');

    // 确保打分被计算并装载
    expect(results[0]?.score).toBeGreaterThan(0);

    // 验证基础设施调用
    expect(mockStorage.queryFTS).toHaveBeenCalledWith('山', 20);
    expect(mockStorage.queryNativeVector).toHaveBeenCalled();
  });

  it('should return only vector results when FTS query is empty', async () => {
    const mockStorage: IHybridSearchStorage = {
      supportsNativeVectorSearch: () => true,
      queryFTS: vi.fn().mockResolvedValue([]),
      queryNativeVector: vi.fn().mockResolvedValue([
        { messageId: 'd-1', sessionId: 's1', chunkText: '开心', score: 0.9, source: 'vector' },
      ] as ISearchResult[]),
      fetchAllEmbeddingsForDecoupledSearch: vi.fn().mockResolvedValue([]),
    };

    const service = new HybridSearchService(mockStorage, createMockConfig());

    const results = await service.search({
      queryText: '',
      queryVector: [0.1, 0.2],
      topK: 10,
    });

    expect(results.length).toBe(1);
    expect(results[0]?.messageId).toBe('d-1');
    // 空 queryText 不应该调 FTS
    expect(mockStorage.queryFTS).not.toHaveBeenCalled();
  });

  it('should fallback to memory KNN when native vector is not supported', async () => {
    const mockStorage: IHybridSearchStorage = {
      supportsNativeVectorSearch: () => false,
      queryFTS: vi.fn().mockResolvedValue([]),
      queryNativeVector: vi.fn(),
      fetchAllEmbeddingsForDecoupledSearch: vi.fn().mockResolvedValue([
        {
          messageId: 'd-1',
          sessionId: 's1',
          chunkText: '一些文本',
          embedding: [0.1, 0.2, 0.3],
          createdAt: Date.now(),
        },
      ]),
    };

    const service = new HybridSearchService(mockStorage, createMockConfig());

    const results = await service.search({
      queryText: '',
      queryVector: [0.1, 0.2, 0.3],
      topK: 10,
    });

    // 应该走 fallback 路径
    expect(mockStorage.fetchAllEmbeddingsForDecoupledSearch).toHaveBeenCalled();
    expect(mockStorage.queryNativeVector).not.toHaveBeenCalled();
    expect(results.length).toBe(1);
  });
});
