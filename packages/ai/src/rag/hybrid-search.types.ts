export type SearchSource = 'fts' | 'vector' | 'hybrid';

export interface ISearchResult {
  messageId: string;
  sessionId: string;
  chunkText: string;
  score: number;
  source: SearchSource;
  createdAt?: number;
}

export interface ISearchQueryOptions {
  queryVector: number[]; // RAG 已预处理后的密集向量数组
  queryText: string;     // FTS5 用户分词
  topK?: number;         // 默认 20
  similarityThreshold?: number; // 如果纯余弦距离低于阈值，抛弃不再参与 RRF 排位
  ftsWeight?: number;    // RRF 合成时关键词权重，默认 0.3
  vectorWeight?: number; // RRF 合成时向量占比，默认 0.7
}

/**
 * 供 Hybrid 搜索服务调用的仓储适配器模型。
 * 由于 SQLite 在没有 vec 拓展或者其他轻量数据库中欠缺底层 KNN，$native 接口可能不存在或引发异常，因此允许优雅降级。
 */
export interface IHybridSearchStorage {
  /**
   * 判断当前数据库设施是否支持底层硬件或原生指令层面的 Vector 检索计算。
   * 如果支持，可以直接让 DB 执行查询；如果不支持，获取全局所有 Embedding 到内存中由 Node 计算。
   */
  supportsNativeVectorSearch(): boolean;

  /**
   * 获取纯正 FTS (全文关键字) 查询返回的对象集，其内的 Score 可以是无意义的分词命中最值
   */
  queryFTS(keyword: string, limit: number): Promise<ISearchResult[]>;

  /**
   * (原生方案) 如果 supportsNativeVectorSearch 为 true 则执行并返回
   */
  queryNativeVector(vector: number[], limit: number, threshold?: number): Promise<ISearchResult[]>;

  /**
   * (降级方案) 如果原生不持支，则使用该方法一次性取回全量 Memory Vector（通常在特定 Session 下有数量上限），
   * 把它们以裸格式传给 JS 调度层纯函数的 KNN 进行遍历裁切
   */
  fetchAllEmbeddingsForDecoupledSearch(sessionGroupId?: string): Promise<{
    messageId: string;
    sessionId: string;
    chunkText: string;
    embedding: number[];
    createdAt?: number;
  }[]>;
}
