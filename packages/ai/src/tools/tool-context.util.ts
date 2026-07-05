import type { ToolContext } from './agent.tool'

export function hasEmbeddingCapability(context: ToolContext): boolean {
  if (context.userConfig?.['hasEmbeddingModel'] === true) return true
  return Boolean(context.embeddingService && context.vectorStore)
}

/** 将运行时已接好的向量能力同步回 userConfig，供 MCP tools/list 与 Agent 过滤一致 */
export function syncMcpToolUserConfig(context: ToolContext): ToolContext {
  const userConfig = { ...(context.userConfig ?? {}) }

  if (context.embeddingService && context.vectorStore) {
    userConfig.hasEmbeddingModel = true
  }

  if (userConfig.ragEnabled === undefined) {
    userConfig.ragEnabled = true
  }

  return { ...context, userConfig }
}
