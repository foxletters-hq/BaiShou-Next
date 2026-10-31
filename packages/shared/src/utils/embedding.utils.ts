/**
 * Embedding 模型识别工具
 *
 * 通过正则匹配模型名来判断该模型是否为 Embedding（向量嵌入）模型，
 * 用于在 UI 层过滤：对话/总结/命名选择器排除 Embedding 模型，
 * Embedding 选择器只显示 Embedding 模型。
 */

/**
 * 规范化模型 ID，剥离特定服务商在模型列表中透传但调用接口不支持的组织命名空间前缀。
 *
 * 背景与规范：
 * 1. Jina AI：官方 GET /v1/models 接口返回的 ID 带组织前缀（如 `jina-ai/jina-embeddings-v3`），
 *    但其向量接口 POST /v1/embeddings 和其它端点只接受裸模型名（如 `jina-embeddings-v3`）。
 *    若直接使用带 `jina-ai/` 的 ID 会导致 404/422 调用失败。
 * 2. Google Gemini：官方 GET /models 接口返回的 ID 带 `models/` 前缀（如 `models/gemini-2.0-flash`），
 *    调用时 SDK 与 API 期望裸名（如 `gemini-2.0-flash`）。
 * 3. 其余组织前缀（例如 SiliconFlow 的 `BAAI/bge-m3`、`Pro/BAAI/bge-m3` 等）为合法且必需的命名空间，
 *    不可盲目剥离，因此采用白名单前缀剥离策略。
 */
export function normalizeModelId(modelId: string): string {
  if (!modelId) return ''
  let trimmed = modelId.trim()
  if (trimmed.startsWith('models/')) {
    trimmed = trimmed.slice('models/'.length)
  }
  if (trimmed.startsWith('jina-ai/')) {
    trimmed = trimmed.slice('jina-ai/'.length)
  }
  return trimmed
}

/**
 * 对拉取到的远端模型 ID 列表进行规范化与有序去重。
 */
export function normalizeRemoteModelIds(remoteIds: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of remoteIds) {
    if (!raw) continue
    const normalized = normalizeModelId(raw)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

/**
 * 智谱官方 embedding 模型 ID。
 * 其 GET /models 通常只返回对话模型，需在拉取结果中并入这些种子。
 */
export const ZHIPU_KNOWN_EMBEDDING_MODELS = ['embedding-2', 'embedding-3'] as const

/**
 * 将智谱已知 embedding 模型并入远端列表：保持远端顺序，缺口补在末尾，去重。
 */
export function mergeZhipuKnownEmbeddingModels(remote: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of remote) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  for (const id of ZHIPU_KNOWN_EMBEDDING_MODELS) {
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

// 匹配常见的 Embedding 模型名称模式
const embeddingRegex =
  /(?:text-embedding|embed|bge-|e5-|retrieval|uae-|gte-|jina-embeddings|voyage-|nomic-embed)/i

// 匹配 Rerank 模型（排除在 Embedding 之外）
const rerankRegex = /(?:rerank|re-rank|re-ranker|re-ranking)/i

// 匹配常见的 TTS 模型名称模式
const ttsRegex = /(?:tts|text-to-speech|speech|voice|audio)/i

/**
 * 判断给定的模型 ID 是否为 Embedding 模型
 */
export function isEmbeddingModel(modelId: string): boolean {
  if (!modelId) return false
  // Rerank 模型不算 Embedding
  if (rerankRegex.test(modelId)) return false
  return embeddingRegex.test(modelId)
}

/**
 * 判断给定的模型 ID 是否为 Rerank 模型
 */
export function isRerankModel(modelId: string): boolean {
  if (!modelId) return false
  return rerankRegex.test(modelId)
}

/**
 * 判断给定的模型 ID 是否为 TTS 模型
 */
export function isTtsModel(modelId: string): boolean {
  if (!modelId) return false
  return ttsRegex.test(modelId)
}

/** 可用于供应商「测试连接」（走 chat/completions）的模型 */
export function isChatModelForConnectionTest(modelId: string): boolean {
  if (!modelId) return false
  return !isEmbeddingModel(modelId) && !isRerankModel(modelId) && !isTtsModel(modelId)
}
