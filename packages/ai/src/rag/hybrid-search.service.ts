export interface IVecSearcher {
  searchByVector(params: { queryVector: number[]; limit: number; modelId: string }): Promise<Array<{
    sourceId: string;
    sourceType: string;
    distance: number; // 越接近 0 越相关
    chunkText: string;
  }>>;
}

export interface IFTSSearcher {
  searchAll(query: string, limit: number): Promise<Array<{
    sourceId: string;
    sourceType: string;
    rankScore: number; // 通常是负数，越小越相关
    contentSnippet: string;
  }>>;
}

export interface HybridSearchResult {
  sourceId: string;
  sourceType: string;
  chunkText: string;
  contentSnippet?: string;
  score: number;      // 融合后得分（越高越相关）
  vecRank: number;    // 向量排名 (-1 表示没排上)
  ftsRank: number;    // 关键词排名 (-1 表示没排上)
}

export class HybridSearchService {
  constructor(
    private readonly vecSearcher: IVecSearcher,
    private readonly ftsSearcher: IFTSSearcher,
    private readonly rrConstK: number = 60 // RRF 常数
  ) {}

  /**
   * Reciprocal Rank Fusion 混合搜索
   */
  async search(params: {
    queryText: string;
    queryVector: number[];
    modelId: string;
    limit?: number;
    alpha?: number; // 语义搜索的权重比例 (0.0 - 1.0)
  }): Promise<HybridSearchResult[]> {
    const k = params.limit ?? 20;
    // RRF 在扩大召回池时才有意义，因此给底层各请求更多的候选数量
    const recallPoolSize = Math.max(k * 2, 60);

    // 1. 发起平行查询
    // 这里如果 FTS 查询为空则跳过
    const [vecResults, ftsResults] = await Promise.all([
      this.vecSearcher.searchByVector({
        queryVector: params.queryVector,
        limit: recallPoolSize,
        modelId: params.modelId
      }),
      params.queryText.trim() ? this.ftsSearcher.searchAll(params.queryText, recallPoolSize) : Promise.resolve([])
    ]);

    // 2. 按 SourceID 收集去重并记录双排名
    const mergedMap = new Map<string, HybridSearchResult>();

    // 向量结果塞入 Map（越靠前 Rank 越小）
    vecResults.forEach((vItem, index) => {
      mergedMap.set(vItem.sourceId, {
        sourceId: vItem.sourceId,
        sourceType: vItem.sourceType,
        chunkText: vItem.chunkText,
        score: 0,
        vecRank: index + 1,
        ftsRank: -1,
      });
    });

    // FTS 结果融合进 Map
    ftsResults.forEach((fItem, index) => {
      const existing = mergedMap.get(fItem.sourceId);
      if (existing) {
        existing.ftsRank = index + 1;
        // 把能够高亮出来的带 <b> 的短语覆盖纯粹的 chunkText 增加前端展示效果
        existing.contentSnippet = fItem.contentSnippet;
      } else {
        mergedMap.set(fItem.sourceId, {
          sourceId: fItem.sourceId,
          sourceType: fItem.sourceType,
          chunkText: fItem.contentSnippet, // 仅有的文本线索
          contentSnippet: fItem.contentSnippet,
          score: 0,
          vecRank: -1,
          ftsRank: index + 1,
        });
      }
    });

    const alpha = params.alpha ?? 0.5; // 默认五五开
    const vecWeight = alpha;
    const ftsWeight = 1.0 - alpha;

    // 3. 按照 RRF 公式算融合分： Score = w / (K + Rank)
    const resultsArray = Array.from(mergedMap.values()).map(item => {
      let rrfScore = 0;
      if (item.vecRank > 0) {
        rrfScore += vecWeight * (1 / (this.rrConstK + item.vecRank));
      }
      if (item.ftsRank > 0) {
        rrfScore += ftsWeight * (1 / (this.rrConstK + item.ftsRank));
      }
      item.score = rrfScore;
      return item;
    });

    // 4. 降序并截断
    return resultsArray.sort((a, b) => b.score - a.score).slice(0, k);
  }
}
