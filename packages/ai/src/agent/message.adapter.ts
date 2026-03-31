import { AgentMessage, AgentPart } from '@baishou/shared';
import { CoreMessage, ToolResultPart, ToolCallPart, TextPart } from 'ai';

export interface MessageWithParts extends AgentMessage {
  parts: AgentPart[];
}

export class MessageAdapter {
  /**
   * 将白守数据库结构的 Message 列表转换为 Vercel AI SDK (CoreMessage[]) 所能理解的格式。
   * 它将正确还原 Assistant 发出的工具调用（ToolCall）以及对应的结果回填（ToolResult）。
   */
  static toVercelMessages(dbMessages: MessageWithParts[]): CoreMessage[] {
    const vercelMessages: CoreMessage[] = [];

    for (const msg of dbMessages) {
      if (!msg.parts || msg.parts.length === 0) continue;

      if (msg.role === 'system' || msg.role === 'user') {
        // System 和 User 现在支持多模态内容与引用快照
        const contentParts: any[] = [];
        
        for (const p of msg.parts) {
          if (p.type === 'text') {
            const data = p.data as any;
            if (data?.text) {
               contentParts.push({ type: 'text', text: data.text });
            }
          } else if (p.type === 'context_snapshot') {
            const snaps = (p.data as any).snapshots;
            if (Array.isArray(snaps) && snaps.length > 0) {
              let refBlock = '\n\n[Reference Contexts]\n';
              for (const s of snaps) {
                refBlock += `--- ${s.title || 'Context'} ---\n${s.content}\n\n`;
              }
              contentParts.push({ type: 'text', text: refBlock });
            }
          } else if (p.type === 'attachment') {
            const att = p.data as any;
            if (att.type === 'image') {
              if (att.url) {
                 contentParts.push({ type: 'image', image: new URL(att.url) });
              } else if (att.data) {
                 // Format as Data URL since that is widely safe for string or buffer fallback in custom impls
                 const prefix = `data:${att.mimeType || 'image/jpeg'};base64,`;
                 const base64Data = att.data.startsWith('data:') ? att.data : (prefix + att.data);
                 contentParts.push({ type: 'image', image: base64Data });
              }
            } else if (att.type === 'file') {
              contentParts.push({
                 type: 'file',
                 mimeType: att.mimeType || 'application/octet-stream',
                 data: att.url ? new URL(att.url) : (att.data || '')
              });
            }
          }
        }

        // Vercel SDK 需要处理：如果纯文本，直接塞 string（节约处理和提高多数模型兼容性）
        let finalContent: any = contentParts;
        if (contentParts.length === 1 && contentParts[0].type === 'text') {
           finalContent = contentParts[0].text;
        } else if (contentParts.length === 0) {
           finalContent = '';
        }

        vercelMessages.push({
          role: msg.role as 'system' | 'user',
          content: finalContent,
        });
      } 
      else if (msg.role === 'assistant') {
        const contentParts: (TextPart | ToolCallPart)[] = [];

        for (const p of msg.parts) {
          if (p.type === 'text') {
            const data = p.data as any;
            if (data.text) {
              contentParts.push({ type: 'text', text: data.text });
            }
          } else if (p.type === 'tool') {
            const data = p.data as any;
            // 还原 ToolCallPart
            if (data.callId && data.name) {
              contentParts.push({
                type: 'tool-call',
                toolCallId: data.callId,
                toolName: data.name,
                args: typeof data.arguments === 'string' ? JSON.parse(data.arguments) : (data.arguments || {}),
              });
            }
          }
        }
        
        if (contentParts.length > 0) {
          vercelMessages.push({
            role: 'assistant',
            content: contentParts,
          });
        }
      } 
      else if (msg.role === 'tool') {
        // Tool Result Message 极其特殊，它里面存放着由于 assistant tool-call 所生成的结果。
        // 在老白守里由于有 ToolPart 存在，可能是直接从里面拿 result
        const resultParts: ToolResultPart[] = [];
        
        for (const p of msg.parts) {
          if (p.type === 'tool') {
            const data = p.data as any;
            if (data.callId && data.name && typeof data.result !== 'undefined') {
              resultParts.push({
                type: 'tool-result',
                toolCallId: data.callId,
                toolName: data.name,
                result: data.result,
              });
            }
          } else if (p.type === 'text') {
            // 说明它可能是一个以 text 代替结果的特殊 part
            const data = p.data as any;
            if (data.toolCallId && data.toolName) {
               resultParts.push({
                 type: 'tool-result',
                 toolCallId: data.toolCallId,
                 toolName: data.toolName,
                 result: data.text,
               });
            }
          }
        }

        if (resultParts.length > 0) {
          vercelMessages.push({
            role: 'tool',
            content: resultParts,
          });
        }
      }
    }

    return vercelMessages;
  }
}
