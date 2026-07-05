/**
 * 修复模型返回的畸形 tool call（大小写不一致等）。
 * 空工具名由 @ai-sdk/openai patch 在流式解析层拦截；此处仅做名称规范化。
 */
export function buildToolCallRepairHandler() {
  return async ({
    toolCall,
    tools
  }: {
    toolCall: { toolCallId: string; toolName: string; input: string }
    tools: Record<string, unknown>
  }): Promise<typeof toolCall | null> => {
    const rawName = String(toolCall.toolName ?? '').trim()
    if (!rawName) {
      return null
    }

    if (tools[rawName]) {
      return null
    }

    const canonical = Object.keys(tools).find(
      (name) => name.toLowerCase() === rawName.toLowerCase()
    )
    if (canonical) {
      return { ...toolCall, toolName: canonical }
    }

    return null
  }
}
