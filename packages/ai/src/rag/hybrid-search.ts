import { IHybridSearchService, SearchResult, HybridSearchOptions } from './hybrid-search.types';

type MergedScore = {
  result: SearchResult;
  ftsScore: number;
  vectorScore: number;
  rawVectorScore: number;
  get totalScore(): number;
  get source(): 'fts' | 'vector' | 'hybrid';
};

export class HybridSearchService implements IHybridSearchService {
  public merge(
    ftsResults: SearchResult[],
    vectorResults: SearchResult[],
    options: HybridSearchOptions = {}
  ): SearchResult[] {
    const limit = options.limit ?? 10;
    const ftsWeight = options.ftsWeight ?? 0.3;
    const vectorWeight = options.vectorWeight ?? 0.7;
    const rrfK = options.rrfK ?? 60;

    const scoreMap = new Map<string, MergedScore>();

    const getMergedObj = (r: SearchResult): MergedScore => {
      const key = `${r.messageId}:${r.sessionId}`;
      if (!scoreMap.has(key)) {
        scoreMap.set(key, {
          result: r,
          ftsScore: 0,
          vectorScore: 0,
          rawVectorScore: 0,
          get totalScore() {
            return this.ftsScore + this.vectorScore;
          },
          get source() {
            if (this.ftsScore > 0 && this.vectorScore > 0) return 'hybrid';
            if (this.ftsScore > 0) return 'fts';
            return 'vector';
          }
        });
      }
      return scoreMap.get(key)!;
    };

    // FTS RRF 排名分数
    for (let i = 0; i < ftsResults.length; i++) {
      const r = ftsResults[i];
      if (!r) continue;
      const merged = getMergedObj(r);
      merged.ftsScore = ftsWeight / (i + rrfK);
    }

    // 向量 余弦相似度
    for (let i = 0; i < vectorResults.length; i++) {
      const r = vectorResults[i];
      if (!r) continue;
      const merged = getMergedObj(r);
      merged.vectorScore = r.score * vectorWeight;
      merged.rawVectorScore = r.score;
    }

    const mergedList = Array.from(scoreMap.values());
    mergedList.sort((a, b) => b.totalScore - a.totalScore); // descending

    return mergedList.slice(0, limit).map(m => ({
      messageId: m.result.messageId,
      sessionId: m.result.sessionId,
      chunkText: m.result.chunkText,
      score: m.rawVectorScore > 0 ? m.rawVectorScore : m.totalScore,
      source: m.source,
      createdAt: m.result.createdAt
    }));
  }

  public vectorSearchFallback(
    queryEmbedding: number[],
    allEmbeddings: Array<{ messageId: string; sessionId: string; chunkText: string; embedding: Uint8Array; createdAt?: Date }>,
    topK = 20
  ): SearchResult[] {
    const scored: Array<{ row: any; score: number }> = [];

    for (const row of allEmbeddings) {
      // Decode Float32Array from Uint8Array blob
      const floatList = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
      if (floatList.length !== queryEmbedding.length) continue;

      const sim = this.cosineSimilarity(queryEmbedding, floatList);
      scored.push({ row, score: sim });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map(s => ({
      messageId: s.row.messageId,
      sessionId: s.row.sessionId,
      chunkText: s.row.chunkText,
      score: s.score,
      source: 'vector',
      createdAt: s.row.createdAt
    }));
  }

  private cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      const valA = a[i] ?? 0;
      const valB = b[i] ?? 0;
      dot += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
