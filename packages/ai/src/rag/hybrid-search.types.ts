export type SearchResultSource = 'fts' | 'vector' | 'hybrid';

export interface SearchResult {
  messageId: string;
  sessionId: string;
  chunkText: string;
  score: number;
  source: SearchResultSource;
  createdAt?: Date;
}

export interface HybridSearchOptions {
  limit?: number;
  ftsWeight?: number;    // 默认 0.3
  vectorWeight?: number; // 默认 0.7
  rrfK?: number;         // 默认 60
}

export interface IHybridSearchService {
  merge(
    ftsResults: SearchResult[],
    vectorResults: SearchResult[],
    options?: HybridSearchOptions
  ): SearchResult[];

  vectorSearchFallback(
    queryEmbedding: number[],
    allEmbeddings: Array<{ messageId: string; sessionId: string; chunkText: string; embedding: Uint8Array; createdAt?: Date; }>,
    topK?: number
  ): SearchResult[];
}
