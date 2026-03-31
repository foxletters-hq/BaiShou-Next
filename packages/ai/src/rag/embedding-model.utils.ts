/**
 * 匹配常见的 Embedding 模型名称模式
 */
const _embeddingRegex = /(?:^text-embedding|embed|bge-|e5-|retrieval|uae-|gte-|jina-embeddings|voyage-|nomic-embed)/i;

/**
 * 匹配 Rerank 模型（排除在 Embedding 之外）
 */
const _rerankRegex = /(?:rerank|re-rank|re-ranker|re-ranking)/i;

/**
 * 判断给定的模型 ID 是否为 Embedding 模型
 * @param modelId 模型标识符
 */
export function isEmbeddingModel(modelId: string): boolean {
  // Rerank 模型不算 Embedding
  if (_rerankRegex.test(modelId)) return false;
  return _embeddingRegex.test(modelId);
}

/**
 * 判断给定的模型 ID 是否为 Rerank 模型
 * @param modelId 模型标识符
 */
export function isRerankModel(modelId: string): boolean {
  return _rerankRegex.test(modelId);
}
