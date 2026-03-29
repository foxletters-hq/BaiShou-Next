import { describe, it, expect } from 'vitest';
import { HybridSearchService } from '../hybrid-search';
import { SearchResult } from '../hybrid-search.types';

describe('HybridSearchService', () => {
  const service = new HybridSearchService();

  it('should merge results with RRF correctly', () => {
    const ftsResults: SearchResult[] = [
      { messageId: 'm1', sessionId: 's1', chunkText: 'text1', score: 0, source: 'fts' }
    ];
    
    const vectorResults: SearchResult[] = [
      { messageId: 'm1', sessionId: 's1', chunkText: 'text1', score: 0.9, source: 'vector' }
    ];

    const merged = service.merge(ftsResults, vectorResults, { limit: 10, ftsWeight: 0.3, vectorWeight: 0.7, rrfK: 60 });
    
    expect(merged.length).toBe(1);
    expect(merged[0]?.messageId).toBe('m1');
    expect(merged[0]?.source).toBe('hybrid');
    // FTS rank 0: 0.3 / 60 = 0.005
    // Vector score: 0.9 * 0.7 = 0.63
    // Total raw: 0.9 (since rawVectorScore > 0, score becomes rawVectorScore)
    expect(merged[0]?.score).toBe(0.9);
  });

  it('should safely fallback to fts only if no vectors provided', () => {
    const ftsResults: SearchResult[] = [
      { messageId: 'm1', sessionId: 's1', chunkText: 'text1', score: 0, source: 'fts' }
    ];

    const merged = service.merge(ftsResults, []);
    
    expect(merged.length).toBe(1);
    expect(merged[0]?.source).toBe('fts');
    // Score should be just the RRF
    expect(merged[0]?.score).toBe(0.3 / 60);
  });

  it('calculates correctly in fallback dart mode', () => {
    const q = [1, 0, 0];
    
    // Convert array to Float32Array and then to Uint8Array
    const arr = new Float32Array([1, 0, 0]);
    const blob1 = new Uint8Array(arr.buffer);

    const arr2 = new Float32Array([0, 1, 0]);
    const blob2 = new Uint8Array(arr2.buffer);

    const embeddings = [
      { messageId: 'm2', sessionId: 's2', chunkText: 't2', embedding: blob2 },
      { messageId: 'm1', sessionId: 's1', chunkText: 't1', embedding: blob1 },
    ];

    const results = service.vectorSearchFallback(q, embeddings);

    expect(results).toHaveLength(2);
    expect(results[0]?.messageId).toBe('m1'); // score 1.0 (exact match)
    expect(results[0]?.score).toBe(1);
    expect(results[1]?.messageId).toBe('m2'); // score 0.0 (orthogonal)
    expect(results[1]?.score).toBe(0);
  });
});
