import { IHybridSearchStorage, ISearchQueryOptions, ISearchResult } from './hybrid-search.types'
import { HybridSearchUtils } from './hybrid-search'

/**
 * 高级 RAG 桥接搜寻服务，支持用户意图触发的同时利用传统关键字分词匹配和向量相量匹配。
 */
export class HybridSearchService {
  constructor(private readonly storage: IHybridSearchStorage) {}

  /**
   * 执行完整的混合查询控制流：
   * 1. 获取 FTS 粗筛序列；
   * 2. 获取 Vector 细筛序列（queryNativeVector 内含原生 → JS 降级）；
   * 3. 重排并按权注入反馈
   */
  public async search(opts: ISearchQueryOptions): Promise<ISearchResult[]> {
    const topK = opts.topK ?? 20

    const ftsPromise = opts.queryText.trim()
      ? this.storage.queryFTS(opts.queryText, topK)
      : Promise.resolve([])

    const vectorPromise = this.storage.queryNativeVector(
      opts.queryVector,
      topK,
      opts.similarityThreshold
    )

    const [ftsResults, vectorResults] = await Promise.all([ftsPromise, vectorPromise])

    if (ftsResults.length === 0) return vectorResults
    if (vectorResults.length === 0) return ftsResults

    return HybridSearchUtils.mergeRRF(
      ftsResults,
      vectorResults,
      topK,
      opts.ftsWeight,
      opts.vectorWeight
    )
  }
}
