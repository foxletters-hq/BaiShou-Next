import type { ModelMessage, ToolResultPart, AssistantContent } from 'ai'

/**
 * 规范化并自愈 ModelMessage 序列，确保工具调用与结果成对闭合且位置合法。
 *
 * 协议约束（OpenAI / DeepSeek 等主流 LLM API 强制规范）：
 * 1. 任何 role: 'tool' 消息的前一条消息必须是 role: 'assistant'，且该 assistant 必须包含匹配的 tool-call。
 * 2. 任何包含 tool-call 的 assistant 消息，后续必须紧跟所有对应 toolCallId 的 tool 结果回复。
 * 3. 消息序列首条绝对不能是 role: 'tool'。
 *
 * 本函数通过自愈机制满足上述不变量：
 * - 孤立 tool 结果：自动在前序 assistant 补齐 tool-call 声明，若无前序 assistant 则合成最小 assistant 锚点。
 * - 未闭合 tool 调用：自动插入合成 tool-result 占位响应（[工具调用已被取消或中断]）。
 */
export function sanitizeModelMessages(messages: ModelMessage[]): ModelMessage[] {
  if (!messages || messages.length === 0) {
    return []
  }

  const result: ModelMessage[] = []
  // 记录最近一条 assistant 消息中已声明、但尚未收到 tool-result 回复的 toolCallId -> toolName
  let pendingToolCalls = new Map<string, string>()

  const flushPendingToolCalls = () => {
    if (pendingToolCalls.size === 0) return
    const synthesizedResults: ToolResultPart[] = []
    for (const [callId, toolName] of pendingToolCalls.entries()) {
      synthesizedResults.push({
        type: 'tool-result',
        toolCallId: callId,
        toolName: toolName || 'unknown',
        output: { type: 'text', value: '[工具调用已被取消或中断]' }
      })
    }
    result.push({
      role: 'tool',
      content: synthesizedResults
    } as ModelMessage)
    pendingToolCalls.clear()
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!

    if (msg.role === 'tool') {
      const content = msg.content
      if (!Array.isArray(content) || content.length === 0) {
        continue
      }

      // 提取本条 tool 消息中的所有 tool-result parts
      const toolParts: ToolResultPart[] = []
      for (const part of content) {
        if (part && typeof part === 'object' && 'type' in part && part.type === 'tool-result') {
          toolParts.push(part as ToolResultPart)
        }
      }

      if (toolParts.length === 0) {
        continue
      }

      // 检查是否有前序 assistant 未声明该 toolCallId
      const missingCallParts: ToolResultPart[] = []
      for (const tp of toolParts) {
        if (!tp.toolCallId || !pendingToolCalls.has(tp.toolCallId)) {
          missingCallParts.push(tp)
        } else {
          pendingToolCalls.delete(tp.toolCallId)
        }
      }

      // 如果有未在前序 assistant 中声明的孤立 tool 结果，自愈补齐其 tool-call 声明
      if (missingCallParts.length > 0) {
        const lastMsg = result.length > 0 ? result[result.length - 1] : null
        if (lastMsg && lastMsg.role === 'assistant') {
          // 在紧邻的上一条 assistant 消息中追加缺失的 tool-call 声明
          const existingContent = Array.isArray(lastMsg.content)
            ? [...lastMsg.content]
            : typeof lastMsg.content === 'string' && lastMsg.content
              ? [{ type: 'text' as const, text: lastMsg.content }]
              : []
          for (const missing of missingCallParts) {
            existingContent.push({
              type: 'tool-call',
              toolCallId: missing.toolCallId,
              toolName: missing.toolName || 'unknown',
              input: {}
            })
          }
          lastMsg.content = existingContent as AssistantContent
        } else {
          // 上一条不是 assistant（或者是开头的 tool），合成一条 assistant 锚点
          const syntheticContent = missingCallParts.map((missing) => ({
            type: 'tool-call' as const,
            toolCallId: missing.toolCallId,
            toolName: missing.toolName || 'unknown',
            input: {}
          }))
          result.push({
            role: 'assistant',
            content: syntheticContent
          } as ModelMessage)
        }
      }

      result.push({
        role: 'tool',
        content: toolParts
      } as ModelMessage)
      continue
    }

    // 遇到非 tool 消息，先闭合前一个 assistant 尚未完成的 tool-call
    flushPendingToolCalls()

    if (msg.role === 'assistant') {
      const content = msg.content
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part && typeof part === 'object' && 'type' in part && part.type === 'tool-call') {
            const call = part as { toolCallId?: string; toolName?: string }
            if (call.toolCallId) {
              pendingToolCalls.set(call.toolCallId, call.toolName || 'unknown')
            }
          }
        }
      }
      result.push(msg)
    } else {
      // system 或 user 消息
      result.push(msg)
    }
  }

  // 序列末尾若仍有未响应的 tool-call，自动闭合
  flushPendingToolCalls()

  return result
}

/**
 * 传输层底层检查：对发往 OpenAI / DeepSeek /chat/completions 的底层 JSON 消息进行合法性自愈
 */
export function sanitizeOpenAiChatMessages(messages: any[]): { messages: any[]; mutated: boolean } {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages: messages || [], mutated: false }
  }

  const result: any[] = []
  let mutated = false
  // 记录上一条 assistant 声明的 tool_calls: id -> name
  let pendingToolCalls = new Map<string, string>()

  const flushPending = () => {
    if (pendingToolCalls.size === 0) return
    for (const [callId] of pendingToolCalls.entries()) {
      result.push({
        role: 'tool',
        tool_call_id: callId,
        content: '[工具执行被中断或取消]'
      })
      mutated = true
    }
    pendingToolCalls.clear()
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (!msg || typeof msg !== 'object') continue

    if (msg.role === 'tool') {
      const callId = msg.tool_call_id
      if (!callId) {
        // 无有效 tool_call_id 的畸形消息，直接丢弃
        mutated = true
        continue
      }

      if (!pendingToolCalls.has(callId)) {
        // 孤儿 tool 消息，自愈补齐其前序 tool-call 声明
        const lastMsg = result.length > 0 ? result[result.length - 1] : null
        const toolName = (msg as any).name || 'unknown'
        const syntheticToolCall = {
          id: callId,
          type: 'function',
          function: { name: toolName, arguments: '{}' }
        }

        if (lastMsg && lastMsg.role === 'assistant') {
          if (!Array.isArray(lastMsg.tool_calls)) {
            lastMsg.tool_calls = []
          }
          lastMsg.tool_calls.push(syntheticToolCall)
          mutated = true
        } else {
          // 前序无 assistant，插入合成的 assistant 锚点
          result.push({
            role: 'assistant',
            content: '',
            tool_calls: [syntheticToolCall]
          })
          mutated = true
        }
      } else {
        pendingToolCalls.delete(callId)
      }

      result.push(msg)
      continue
    }

    flushPending()

    if (msg.role === 'assistant') {
      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          if (tc && tc.id) {
            pendingToolCalls.set(tc.id, tc.function?.name || 'unknown')
          }
        }
      }
      result.push(msg)
    } else {
      result.push(msg)
    }
  }

  flushPending()

  if (result.length !== messages.length) {
    mutated = true
  }

  return { messages: result, mutated }
}
