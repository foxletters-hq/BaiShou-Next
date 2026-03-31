import { IHybridSearchStorage, ISearchQueryOptions, ISearchResult } from './hybrid-search.types';
import { HybridSearchUtils } from './hybrid-search';
import { IEmbeddingConfig } from './embedding.types';

/**
 * 高级 RAG 桥接搜寻服务，支持用户意图触发的同时利用传统关键字分词匹配和向量相量匹配。
 */
export class HybridSearchService {

  constructor(
    private readonly storage: IHybridSearchStorage,
    private readonly config: IEmbeddingConfig
  ) {}

  /**
   * 执行完整的混合查询控制流：
   * 1. 获取 FTS 粗筛序列；
   * 2. 获取 Vector 细筛序列（Native 或是 Fallback Memory）；
   * 3. 重排并按权注入反馈
   */
  public async search(opts: ISearchQueryOptions): Promise<ISearchResult[]> {
    const topK = opts.topK ?? 20;

    // --- 1. 获取 FTS 路经结果 ---
    const ftsPromise = opts.queryText.trim() ? 
        this.storage.queryFTS(opts.queryText, topK) : 
        Promise.resolve([]);

    // --- 2. 获取 Vector 路经结果 ---
    let vectorPromise: Promise<ISearchResult[]>;

    if (this.storage.supportsNativeVectorSearch()) {
        // 首选底层引擎的内置向量检索，极速响应并支持大数据量下推
        vectorPromise = this.storage.queryNativeVector(opts.queryVector, topK, opts.similarityThreshold);
    } else {
        // 退化至纯函数内存检索。
        // （通常在会话级检索时，内存总量是可控的，避免前端由于缺少 vec sqlite 扩展而导致查无结果）
        vectorPromise = this.storage.fetchAllEmbeddingsForDecoupledSearch().then((allVectors) => {
            return HybridSearchUtils.vectorSearchMemoryFallback(
                opts.queryVector, 
                allVectors, 
                topK, 
                opts.similarityThreshold ?? 0.0
            );
        });
    }

    // --- 3. 合体发散式管道请求 ---
    const [ftsResults, vectorResults] = await Promise.all([ftsPromise, vectorPromise]);

    // --- 4. 空搜处理与归一重排 ---
    if (ftsResults.length === 0) return vectorResults;
    if (vectorResults.length === 0) return ftsResults;

    return HybridSearchUtils.mergeRRF(
        ftsResults, 
        vectorResults, 
        topK, 
        opts.ftsWeight, 
        opts.vectorWeight
    );
  }
}
