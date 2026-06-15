/**
 * Gemini Thought Signature 中间件
 *
 * Gemini 2.5+ 在 functionCall 响应里附带 thoughtSignature，多轮对话必须原样回传。
 * 官方允许使用 magic string 跳过校验（仅开发/兼容场景）。
 *
 * @see https://ai.google.dev/gemini-api/docs/thought-signatures
 */

import type { ModelMessage } from 'ai'
import type { MessageMiddleware } from './message-middleware'

/** Google 文档给出的 thought signature 跳过标记 */
const GEMINI_SKIP_SIGNATURE = 'skip_thought_signature_validator'

export class GeminiThoughtSignatureMiddleware implements MessageMiddleware {
  readonly name = 'gemini-thought-signature-skip'

  process(messages: ModelMessage[]): ModelMessage[] {
    return messages.map((message) => this.annotateAssistantToolCalls(message))
  }

  private annotateAssistantToolCalls(message: ModelMessage): ModelMessage {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) {
      return message
    }

    const nextContent = message.content.map((part) => {
      if (typeof part !== 'object' || part === null || !('type' in part)) {
        return part
      }
      if (part.type !== 'tool-call') {
        return part
      }

      const existing = (part as { providerOptions?: Record<string, unknown> }).providerOptions
      return {
        ...part,
        providerOptions: {
          ...(existing ?? {}),
          google: {
            ...((existing?.google as Record<string, unknown> | undefined) ?? {}),
            thoughtSignature: GEMINI_SKIP_SIGNATURE
          }
        }
      }
    })

    return { ...message, content: nextContent } as ModelMessage
  }
}
