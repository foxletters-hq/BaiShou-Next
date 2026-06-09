import { AgentMessage, AgentPart } from '@baishou/shared'
import { ModelMessage, ToolResultPart } from 'ai'
import {
  appendFileAttachmentToContentParts,
  appendImagePartToContentParts,
  finalizeUserContentParts
} from './attachment-content.builder'

export interface MessageWithParts extends AgentMessage {
  parts: AgentPart[]
}

export class MessageAdapter {
  /**
   * 将白守数据库结构的 Message 列表转换为 Vercel AI SDK (ModelMessage[]) 所能理解的格式。
   * 它将正确还原 Assistant 发出的工具调用（ToolCall）以及对应的结果回填（ToolResult）。
   */
  static async toVercelMessages(
    dbMessages: MessageWithParts[],
    activeModelId?: string,
    activeProviderType?: string
  ): Promise<ModelMessage[]> {
    const vercelMessages: ModelMessage[] = []

    for (const msg of dbMessages) {
      if (!msg.parts || msg.parts.length === 0) continue

      if (msg.role === 'system' || msg.role === 'user') {
        // System 和 User 现在支持多模态内容与引用快照
        const contentParts: any[] = []

        for (const p of msg.parts) {
          if (p.type === 'text') {
            const data = p.data as any
            if (data?.text) {
              contentParts.push({ type: 'text', text: data.text })
            }
          } else if (p.type === 'context_snapshot') {
            const snaps = (p.data as any).snapshots
            if (Array.isArray(snaps) && snaps.length > 0) {
              let refBlock = '\n\n[Reference Contexts]\n'
              for (const s of snaps) {
                refBlock += `--- ${s.title || 'Context'} ---\n${s.content}\n\n`
              }
              contentParts.push({ type: 'text', text: refBlock })
            }
          } else if (p.type === 'image') {
            await appendImagePartToContentParts(contentParts, p.data as any, {
              modelId: activeModelId
            })
          } else if (p.type === 'attachment') {
            await appendFileAttachmentToContentParts(contentParts, p.data as any, {
              modelId: activeModelId,
              providerType: activeProviderType
            })
          }
        }

        const finalContent = finalizeUserContentParts(contentParts)

        vercelMessages.push({
          role: msg.role as 'system' | 'user',
          content: finalContent
        })
      } else if (msg.role === 'assistant') {
        const contentParts: any[] = []
        // 收集已完成的工具调用结果，后续生成独立的 role: 'tool' 消息
        const toolResultParts: ToolResultPart[] = []

        for (const p of msg.parts) {
          if (p.type === 'text') {
            const data = p.data as any
            if (data.text) {
              if (data.isReasoning) {
                // 深度求索 API 要求将推理内容作为 reasoning 类型回传
                contentParts.push({ type: 'reasoning', text: data.text })
              } else {
                contentParts.push({ type: 'text', text: data.text })
              }
            }
          } else if (p.type === 'tool') {
            const data = p.data as any
            if (data.callId && data.name) {
              // 解析工具参数，确保始终是有效的 JSON 对象
              let parsedArgs: Record<string, unknown> = {}
              if (data.arguments) {
                try {
                  parsedArgs =
                    typeof data.arguments === 'string'
                      ? JSON.parse(data.arguments)
                      : data.arguments || {}
                } catch {
                  parsedArgs = {}
                }
              }

              // 符合 Vercel AI SDK ToolCallPart 标准接口
              // @see node_modules/@ai-sdk/provider-utils/dist/index.d.ts:656
              // input 是标准字段，args 是向后兼容字段
              contentParts.push({
                type: 'tool-call',
                toolCallId: data.callId,
                toolName: data.name,
                args: parsedArgs,
                input: parsedArgs
              })

              // Vercel AI SDK 要求每个 tool-call 必须有对应的 tool-result
              // 在 role: 'tool' 消息中。已完成的工具提取结果，失败的提供错误信息。
              toolResultParts.push({
                type: 'tool-result',
                toolCallId: data.callId,
                toolName: data.name,
                output: {
                  type: 'text',
                  value: data.result ?? `[工具执行失败: ${data.name}]`
                }
              })
            }
          }
        }

        if (contentParts.length > 0) {
          vercelMessages.push({
            role: 'assistant',
            content: contentParts
          })

          // 为已完成的工具调用生成独立的 tool 消息（紧跟在助理消息之后）
          // 这确保了 Vercel AI SDK 的 tool-call ↔ tool-result 校验通过
          if (toolResultParts.length > 0) {
            vercelMessages.push({
              role: 'tool',
              content: toolResultParts
            })
          }
        }
      } else if (msg.role === 'tool') {
        // Tool Result Message 极其特殊，它里面存放着由于 assistant tool-call 所生成的结果。
        // 在老白守里由于有 ToolPart 存在，可能是直接从里面拿 result
        const resultParts: ToolResultPart[] = []

        for (const p of msg.parts) {
          if (p.type === 'tool') {
            const data = p.data as any
            if (data.callId && data.name && typeof data.result !== 'undefined') {
              resultParts.push({
                type: 'tool-result',
                toolCallId: data.callId,
                toolName: data.name,
                output: { type: 'text', value: data.result }
              })
            }
          } else if (p.type === 'text') {
            // 说明它可能是一个以 text 代替结果的特殊 part
            const data = p.data as any
            if (data.toolCallId && data.toolName) {
              resultParts.push({
                type: 'tool-result',
                toolCallId: data.toolCallId,
                toolName: data.toolName,
                output: { type: 'text', value: data.text }
              })
            }
          }
        }

        if (resultParts.length > 0) {
          vercelMessages.push({
            role: 'tool',
            content: resultParts
          })
        }
      }
    }

    return vercelMessages
  }
}
