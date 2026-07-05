/**
 * 粗估文本 token 数（中英文混合场景约 3 字符/token）。
 * 与 Agent 上下文压缩触发估算策略一致，跨端轻量、无需加载 tiktoken。
 */
export function estimateTextTokensApprox(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 3)
}
