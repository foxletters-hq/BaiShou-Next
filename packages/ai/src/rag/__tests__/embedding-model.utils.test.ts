import { describe, it, expect } from 'vitest';
import { isEmbeddingModel, isRerankModel } from '../embedding-model.utils';

describe('Embedding Model Utils', () => {
  describe('isEmbeddingModel', () => {
    it('should match standard embedding models', () => {
      expect(isEmbeddingModel('text-embedding-3-small')).toBe(true);
      expect(isEmbeddingModel('bge-m3')).toBe(true);
      expect(isEmbeddingModel('e5-large-v2')).toBe(true);
      expect(isEmbeddingModel('nomic-embed-text')).toBe(true);
      expect(isEmbeddingModel('text-embedding-004')).toBe(true);
      expect(isEmbeddingModel('voyage-2')).toBe(true);
    });

    it('should ignore rerank models', () => {
      expect(isEmbeddingModel('bge-reranker-base')).toBe(false);
      expect(isEmbeddingModel('jina-reranker-v1-base-en')).toBe(false);
    });

    it('should not match chat models', () => {
      expect(isEmbeddingModel('gpt-4o')).toBe(false);
      expect(isEmbeddingModel('claude-3-5-sonnet')).toBe(false);
      expect(isEmbeddingModel('gemini-1.5-pro')).toBe(false);
      expect(isEmbeddingModel('deepseek-chat')).toBe(false);
    });
  });

  describe('isRerankModel', () => {
    it('should match rerank models', () => {
      expect(isRerankModel('bge-reranker-base')).toBe(true);
      expect(isRerankModel('cohere-rerank-english-v3.0')).toBe(true);
      expect(isRerankModel('jina-re-rank')).toBe(true);
    });

    it('should not match embedding or chat models', () => {
      expect(isRerankModel('text-embedding-3-small')).toBe(false);
      expect(isRerankModel('gpt-4')).toBe(false);
    });
  });
});
