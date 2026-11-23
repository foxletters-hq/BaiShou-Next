import { logger } from '@baishou/shared'
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
    const filter = {
      ...opts.filter,
      threshold: opts.similarityThreshold ?? opts.filter?.threshold
    }

    let ftsQueryMs = 0
    const ftsPromise = opts.queryText.trim()
      ? (async () => {
          const startedAt = Date.now()
          const rows = await this.storage.queryFTS(opts.queryText, topK, {
            startMs: filter.startMs,
            endMs: filter.endMs,
            vaultId: filter.vaultId
          })
          ftsQueryMs = Date.now() - startedAt
          return rows
        })()
      : Promise.resolve([])

    let vectorQueryMs = 0
    const vectorPromise = (async () => {
      const startedAt = Date.now()
      const rows = await this.storage.queryNativeVector(opts.queryVector, topK, filter)
      vectorQueryMs = Date.now() - startedAt
      return rows
    })()

    const [ftsResults, vectorResults] = await Promise.all([ftsPromise, vectorPromise])

    const finalResults =
      ftsResults.length === 0
        ? vectorResults
        : vectorResults.length === 0
          ? ftsResults
          : HybridSearchUtils.mergeRRF(
              ftsResults,
              vectorResults,
              topK,
              opts.ftsWeight,
              opts.vectorWeight
            )

    // 脱敏性能日志：仅记录分段耗时、向量维度与命中数，严禁输出 query 明文或原始浮点数组
    logger.info('[HybridSearch] search metrics', {
      embedApiMs: opts.embedApiMs ?? null,
      vectorQueryMs,
      ftsQueryMs,
      dimension: opts.queryVector.length,
      resultCount: finalResults.length
    })

    return finalResults
  }
}
