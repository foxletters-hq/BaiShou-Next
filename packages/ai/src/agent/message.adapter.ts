import { AgentMessage, AgentPart } from '@baishou/shared'
import { ModelMessage, ToolResultPart } from 'ai'
import {
  injectModelMetadata,
  injectModelMetadataIntoAssistantParts,
  injectModelMetadataIntoToolResults
} from '@baishou/shared'
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

        const finalContent = injectModelMetadata(
          finalizeUserContentParts(contentParts),
          msg.role,
          msg.createdAt
        )

        vercelMessages.push({
          role: msg.role as 'system' | 'user',
          content: finalContent
        } as ModelMessage)
      } else if (msg.role === 'assistant') {
        const contentParts: any[] = []
        const toolResultParts: ToolResultPart[] = []

        for (const p of msg.parts) {
          if (p.type === 'text') {
            const data = p.data as any
            if (data.text) {
              if (data.isReasoning) {
                contentParts.push({ type: 'reasoning', text: data.text })
              } else {
                contentParts.push({ type: 'text', text: data.text })
              }
            }
          } else if (p.type === 'tool') {
            const data = p.data as any
            if (data.callId && data.name) {
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

              contentParts.push({
                type: 'tool-call',
                toolCallId: data.callId,
                toolName: data.name,
                args: parsedArgs,
                input: parsedArgs
              })

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
            content: injectModelMetadataIntoAssistantParts(contentParts, msg.createdAt)
          })

          if (toolResultParts.length > 0) {
            vercelMessages.push({
              role: 'tool',
              content: injectModelMetadataIntoToolResults(toolResultParts, msg.createdAt)
            })
          }
        }
      } else if (msg.role === 'tool') {
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
            content: injectModelMetadataIntoToolResults(resultParts, msg.createdAt)
          })
        }
      }
    }

    return vercelMessages
  }
}
