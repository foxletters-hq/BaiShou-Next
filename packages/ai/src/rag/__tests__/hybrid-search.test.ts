import { describe, it, expect, vi } from 'vitest';
import { ISearchResult } from '../hybrid-search.types';
import { HybridSearchUtils } from '../hybrid-search';

describe('HybridSearchUtils (Pure Math)', () => {
  describe('cosineSimilarity', () => {
    it('should correctly calculate exact 1.0 for identical normalize vector', () => {
      const v1 = [0, 1, 0];
      const v2 = [0, 1, 0];
      const sim = HybridSearchUtils.cosineSimilarity(v1, v2);
      expect(sim).toBe(1.0);
    });

    it('should calculate accurate angular divergence', () => {
      const v1 = [1, 0];
      const v2 = [0, 1];
      const sim = HybridSearchUtils.cosineSimilarity(v1, v2);
      expect(sim).toBe(0.0); // 极度正交
    });

    it('should handle zero distance gracefully', () => {
      const sim = HybridSearchUtils.cosineSimilarity([0, 0], [1, 1]);
      expect(sim).toBe(0.0);
    });
  });

  describe('vectorSearchMemoryFallback', () => {
    it('should sort embeddings by inner dot product and prune by threshold', () => {
      const query = [1, 0, 0];
      const db = [
        { messageId: '1', sessionId: 'A', chunkText: 'foo', embedding: [1, 0, 0] },     // Sim: 1.0
        { messageId: '2', sessionId: 'A', chunkText: 'bar', embedding: [0.5, 0.5, 0] }, // Sim: ~0.707
        { messageId: '3', sessionId: 'B', chunkText: 'baz', embedding: [0, 1, 0] },     // Sim: 0
      ];

      const res = HybridSearchUtils.vectorSearchMemoryFallback(query, db, 2, 0.1);
      expect(res.length).toBe(2);
      expect(res[0].messageId).toBe('1');
      expect(res[0].score).toBe(1.0);
      expect(res[1].messageId).toBe('2');
      expect(res[1].score).toBeGreaterThan(0.5); // cosine ~0.707
    });

    it('should cut off results under threshold', () => {
       const query = [1, 0];
       const db = [
         { messageId: '1', sessionId: 'A', chunkText: 'matched', embedding: [0.8, 0.2] }, // sim>0.8
         { messageId: '2', sessionId: 'A', chunkText: 'low', embedding: [0.1, 0.9] },     // sim ~0.1
       ];
       const res = HybridSearchUtils.vectorSearchMemoryFallback(query, db, 10, 0.5);
       expect(res.length).toBe(1);
       expect(res[0].messageId).toBe('1');
    });
  });

  describe('mergeRRF (Reciprocal Rank Fusion)', () => {
    it('should combine and penalize duplicate ranks properly', () => {
       const fts: ISearchResult[] = [
         { messageId: 'F1', sessionId: 'A', chunkText: 'T1', score: 99.0, source: 'fts' }, // FTS排第1 (index 0)
         { messageId: 'B1', sessionId: 'A', chunkText: 'Both', score: 85.0, source: 'fts' }, // FTS排第2 (index 1)
       ];
       const vec: ISearchResult[] = [
         { messageId: 'B1', sessionId: 'A', chunkText: 'Both', score: 0.95, source: 'vector' }, // Vector排第1 (index 0)
         { messageId: 'V1', sessionId: 'A', chunkText: 'T2', score: 0.82, source: 'vector' },   // Vector排第2 (index 1)
       ];

       const merged = HybridSearchUtils.mergeRRF(fts, vec, 10, 0.3, 0.7);
       
       // B1 同时出现在双路的高排位，RRF叠加必然反超 F1 或将其登顶为最高分数
       expect(merged.length).toBe(3); // F1, B1, V1
       const b1Result = merged.find(m => m.messageId === 'B1')!;
       expect(b1Result.source).toBe('hybrid'); // 双模混合来源
       // 虽然有 RRF 奖励，纯向量侧保留的最底物仍使用 Vector分数，但 B1 作为混合项
       // 我们将根据合并后的分值验证是否排在第一
       expect(merged[0].messageId).toBe('B1'); // 取决于公式推演，通常它会因拥有完整的两路重叠成为优胜者
    });
  });
});
