/**
 * Embedding 模型识别工具
 *
 * 通过正则匹配模型名来判断该模型是否为 Embedding（向量嵌入）模型，
 * 用于在 UI 层过滤：对话/总结/命名选择器排除 Embedding 模型，
 * Embedding 选择器只显示 Embedding 模型。
 */

// 匹配常见的 Embedding 模型名称模式
const embeddingRegex = /(?:text-embedding|embed|bge-|e5-|retrieval|uae-|gte-|jina-embeddings|voyage-|nomic-embed)/i;

// 匹配 Rerank 模型（排除在 Embedding 之外）
const rerankRegex = /(?:rerank|re-rank|re-ranker|re-ranking)/i;

/**
 * 判断给定的模型 ID 是否为 Embedding 模型
 */
export function isEmbeddingModel(modelId: string): boolean {
  if (!modelId) return false;
  // Rerank 模型不算 Embedding
  if (rerankRegex.test(modelId)) return false;
  return embeddingRegex.test(modelId);
}

/**
 * 判断给定的模型 ID 是否为 Rerank 模型
 */
export function isRerankModel(modelId: string): boolean {
  if (!modelId) return false;
  return rerankRegex.test(modelId);
}
