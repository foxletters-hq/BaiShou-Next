/**
 * Gemini Thought Signature 跳过中间件
 *
 * Gemini 2.5/3 模型的 functionCall 响应包含 thoughtSignature 字段，
 * 回传历史时必须原样携带，否则返回 400 错误。
 *
 * 本中间件使用 magic string 'skip_thought_signature_validator' 跳过验证。
 * 参考: https://ai.google.dev/gemini-api/docs/thought-signatures
 *
 * 原始实现：lib/agent/middleware/gemini_thought_signature.dart (39 行)
 */

import type { ModelMessage } from 'ai';
import type { MessageMiddleware } from './message-middleware';

const SKIP_VALIDATOR = 'skip_thought_signature_validator';

export class GeminiThoughtSignatureMiddleware implements MessageMiddleware {
  readonly name = 'gemini-thought-signature-skip';

  process(messages: ModelMessage[]): ModelMessage[] {
    for (const message of messages) {
      if (message.role !== 'assistant') continue;

      // Vercel AI SDK 将 tool calls 包装在 content parts 中
      if (!Array.isArray(message.content)) continue;

      let isFirstToolCall = true;
      for (const part of message.content) {
        if (typeof part === 'object' && 'type' in part && part.type === 'tool-call') {
          if (isFirstToolCall) {
            // 在 experimental_providerMetadata 上注入跳过标记
            // 当前 Vercel AI SDK 通过此字段透传 provider 元数据
            (part as unknown as Record<string, unknown>)['experimental_providerMetadata'] = {
              google: { thoughtSignature: SKIP_VALIDATOR },
            };
            isFirstToolCall = false;
          }
        }
      }
    }
    return messages;
  }
}
