let pendingEmbeddingFocus = false

/** 记忆中心「去配置」：打开全局默认模型页并聚焦嵌入模型 */
export function requestAiModelsEmbeddingFocus(): void {
  pendingEmbeddingFocus = true
}

export function consumeAiModelsEmbeddingFocus(): boolean {
  if (!pendingEmbeddingFocus) return false
  pendingEmbeddingFocus = false
  return true
}

/** @internal 仅供单元测试重置模块级标记 */
export function resetAiModelsEmbeddingFocusForTests(): void {
  pendingEmbeddingFocus = false
}
