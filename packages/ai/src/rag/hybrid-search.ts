import { ISearchResult } from './hybrid-search.types';

/**
 * RAG 后期管道：提供全内存执行的检索重排（Rerank via RRF）以及应对本地库缺乏原生功能时的兜底 KNN。
 */
export class HybridSearchUtils {
  private static readonly RRF_K = 60;

  /**
   * 采用 RRF 算法合并排序双路（关键词+语义）结果集，以解决两者分数尺度（Score Scale）不可名状无法直接相加的问题。
   *
   * @param ftsResults - 根据 FTS rank 排序的返回全集
   * @param vectorResults - 根据 Cosine Sim 排序的返回全集
   * @param limit - 最终所需 TopK
   * @param ftsWeight - RRF 公式中的 FTS 奖励权重
   * @param vectorWeight - RRF 公式中的 Vector 奖励权重
   */
  public static mergeRRF(
    ftsResults: ISearchResult[],
    vectorResults: ISearchResult[],
    limit: number = 10,
    ftsWeight: number = 0.3,
    vectorWeight: number = 0.7
  ): ISearchResult[] {
    const scoreMap = new Map<string, {
      result: ISearchResult;
      ftsScore: number;
      vectorScore: number;
      rawVectorScore: number;
    }>();

    // 构建唯一复合键
    const makeKey = (r: ISearchResult) => `${r.messageId}:${r.sessionId}`;

    // 处理 FTS 的 RRF 分数注入
    for (let i = 0; i < ftsResults.length; i++) {
        const r = ftsResults[i];
        const key = makeKey(r);
        const rrfScore = ftsWeight / (i + this.RRF_K);
        if (!scoreMap.has(key)) {
            scoreMap.set(key, { result: r, ftsScore: 0, vectorScore: 0, rawVectorScore: 0 });
        }
        scoreMap.get(key)!.ftsScore = rrfScore;
    }

    // 处理 Vector 的原始分数融合
    for (let i = 0; i < vectorResults.length; i++) {
        const r = vectorResults[i];
        const key = makeKey(r);
        if (!scoreMap.has(key)) {
            scoreMap.set(key, { result: r, ftsScore: 0, vectorScore: 0, rawVectorScore: 0 });
        }
        const state = scoreMap.get(key)!;
        state.vectorScore = r.score * vectorWeight;
        state.rawVectorScore = r.score;
    }

    // 合并计分排名
    const merged = Array.from(scoreMap.values());
    merged.sort((a, b) => {
        const aTotal = a.ftsScore + a.vectorScore;
        const bTotal = b.ftsScore + b.vectorScore;
        return bTotal - aTotal; // 降序
    });

    return merged.slice(0, limit).map(m => {
        let finalSource = m.result.source;
        if (m.ftsScore > 0 && m.vectorScore > 0) {
            finalSource = 'hybrid';
        } else if (m.ftsScore > 0) {
            finalSource = 'fts';
        } else {
            finalSource = 'vector';
        }

        return {
            messageId: m.result.messageId,
            sessionId: m.result.sessionId,
            chunkText: m.result.chunkText,
            // 混合结果与纯向量结果均保留语义相似度原始参考分，纯 FTS 则使用合并总分
            score: m.rawVectorScore > 0 ? m.rawVectorScore : (m.ftsScore + m.vectorScore),
            source: finalSource,
            createdAt: m.result.createdAt
        };
    });
  }

  /**
   * KNN 的基于 JS 的纯切片遍历（O(N) - O(N log N)）。用于无法依赖 Native 原生向量数据库处理的情形作为优雅降级。
   *
   * @param queryEmbedding 必须是 L2 归一化后传进来的单位查询向量
   * @param db 扁平化导出的所有数据库内记忆块实体
   * @param topK 要求取出的最大数量
   * @param threshold 距离截断
   */
  public static vectorSearchMemoryFallback(
    queryEmbedding: number[],
    db: { messageId: string, sessionId: string, chunkText: string, embedding: number[], createdAt?: number }[],
    topK: number = 20,
    threshold: number = 0.0
  ): ISearchResult[] {
    const scored: { row: typeof db[0]; score: number }[] = [];

    for (const row of db) {
        if (row.embedding.length !== queryEmbedding.length) continue;
        const sim = this.cosineSimilarity(queryEmbedding, row.embedding);
        if (sim >= threshold) {
            scored.push({ row, score: sim });
        }
    }

    // 按得分排序（降序）
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

  /**
   * 余弦相似度原生实现
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    const len = a.length;
    for (let i = 0; i < len; i++) {
        const valA = a[i];
        const valB = b[i];
        dot += valA * valB;
        normA += valA * valA;
        normB += valB * valB;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dot / denom;
  }
}
