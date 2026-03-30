import { describe, it, expect, vi } from 'vitest';
import {
  MemoryDeduplicationService,
  type DeduplicationEmbeddingService,
  type DeduplicationVectorStore,
  type DeduplicationLLM,
} from '../session/memory-deduplication.service';

function createMockEmbeddingService(): DeduplicationEmbeddingService {
  return {
    embedQuery: vi.fn(async () => [0.1, 0.2, 0.3]),
    embedText: vi.fn(async () => {}),
  };
}

function createMockVectorStore(
  candidates: Array<{
    embeddingId: string;
    sourceType: string;
    sourceId: string;
    chunkText: string;
    createdAt: number;
    distance: number;
  }> = [],
): DeduplicationVectorStore {
  return {
    searchSimilar: vi.fn(async () => candidates),
    deleteBySource: vi.fn(async () => {}),
    updateTimestamp: vi.fn(async () => {}),
  };
}

describe('MemoryDeduplicationService', () => {
  it('should store directly when no candidates found', async () => {
    const service = new MemoryDeduplicationService(
      createMockEmbeddingService(),
      createMockVectorStore([]),
    );

    const result = await service.checkAndMerge({
      newMemoryContent: 'test memory',
      sessionId: 'session-1',
    });

    expect(result.action).toBe('stored');
    expect(result.highestSimilarity).toBe(0);
  });

  it('should skip when similarity > DUPLICATE_THRESHOLD', async () => {
    const store = createMockVectorStore([
      {
        embeddingId: 'emb-1',
        sourceType: 'chat',
        sourceId: 'mem-old',
        chunkText: 'test memory',
        createdAt: Date.now(),
        distance: 0.05, // similarity = 0.95 > 0.92
      },
    ]);

    const service = new MemoryDeduplicationService(
      createMockEmbeddingService(),
      store,
    );

    const result = await service.checkAndMerge({
      newMemoryContent: 'test memory',
      sessionId: 'session-1',
    });

    expect(result.action).toBe('skipped');
    expect(result.highestSimilarity).toBeCloseTo(0.95, 2);
    expect(store.updateTimestamp).toHaveBeenCalledWith('emb-1');
  });

  it('should store when similarity < MERGE_THRESHOLD', async () => {
    const service = new MemoryDeduplicationService(
      createMockEmbeddingService(),
      createMockVectorStore([
        {
          embeddingId: 'emb-1',
          sourceType: 'chat',
          sourceId: 'mem-old',
          chunkText: 'unrelated memory',
          createdAt: Date.now(),
          distance: 0.5, // similarity = 0.5 < 0.70
        },
      ]),
    );

    const result = await service.checkAndMerge({
      newMemoryContent: 'new topic',
      sessionId: 'session-1',
    });

    expect(result.action).toBe('stored');
    expect(result.highestSimilarity).toBeCloseTo(0.5, 2);
  });

  it('should attempt LLM merge when in merge zone', async () => {
    const llm: DeduplicationLLM = {
      generateContent: vi.fn(async () =>
        JSON.stringify({
          action: 'merge',
          merge_target_ids: ['emb-1'],
          merged_content: '合并后的记忆内容',
        }),
      ),
    };

    const store = createMockVectorStore([
      {
        embeddingId: 'emb-1',
        sourceType: 'chat',
        sourceId: 'mem-old',
        chunkText: '相似的记忆',
        createdAt: Date.now(),
        distance: 0.2, // similarity = 0.80, in merge zone
      },
    ]);

    const embedding = createMockEmbeddingService();

    const service = new MemoryDeduplicationService(embedding, store, llm);

    const result = await service.checkAndMerge({
      newMemoryContent: '更新后的记忆',
      sessionId: 'session-1',
    });

    expect(result.action).toBe('merged');
    expect(result.mergedContent).toBe('合并后的记忆内容');
    expect(result.removedIds).toHaveLength(1);
    expect(store.deleteBySource).toHaveBeenCalled();
    expect(embedding.embedText).toHaveBeenCalled();
  });

  it('should fallback to stored when LLM is not available', async () => {
    const service = new MemoryDeduplicationService(
      createMockEmbeddingService(),
      createMockVectorStore([
        {
          embeddingId: 'emb-1',
          sourceType: 'chat',
          sourceId: 'mem-old',
          chunkText: '相似的记忆',
          createdAt: Date.now(),
          distance: 0.2, // similarity = 0.80
        },
      ]),
      // no LLM provided
    );

    const result = await service.checkAndMerge({
      newMemoryContent: '新记忆',
      sessionId: 'session-1',
    });

    expect(result.action).toBe('stored');
  });

  it('should store when embedding fails', async () => {
    const embedding = createMockEmbeddingService();
    (embedding.embedQuery as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const service = new MemoryDeduplicationService(
      embedding,
      createMockVectorStore(),
    );

    const result = await service.checkAndMerge({
      newMemoryContent: 'test',
      sessionId: 'session-1',
    });

    expect(result.action).toBe('stored');
  });
});
