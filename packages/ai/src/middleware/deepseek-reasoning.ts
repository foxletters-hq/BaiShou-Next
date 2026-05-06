/**
 * DeepSeek Reasoning Content 中间件
 *
 * DeepSeek API 的 thinking 模式要求：当 assistant 消息包含 reasoning_content 时，
 * 后续请求必须将该内容回传。否则返回 400 错误：
 * "The `reasoning_content` in the thinking mode must be passed back to the API."
 *
 * 由于 @ai-sdk/openai 的 convertToOpenAIChatMessages 会忽略 reasoning 类型的 part，
 * 本中间件使用 Vercel AI SDK 的 transformParams，在消息发送前将 reasoning 内容
 * 以 <think> 标签内联到 text part 中，确保 DeepSeek API 能接收到思维链内容。
 *
 * 参考: DeepSeek API 文档 - 多轮对话中的思维链
 */

import type { LanguageModelV3Middleware } from '@ai-sdk/provider';

/**
 * 创建 DeepSeek reasoning 内容处理中间件。
 * 将 assistant 消息中的 reasoning parts 转换为 <think> 标签内联到 text 中。
 */
export function createDeepSeekReasoningMiddleware(): LanguageModelV3Middleware {
  return {
    transformParams: async ({ params, type }) => {
      // eslint-disable-next-line no-console
      console.log('[DeepSeekReasoning] transformParams called, type=%s', type);

      if (!params.prompt) {
        // eslint-disable-next-line no-console
        console.log('[DeepSeekReasoning] No prompt found in params');
        return params;
      }

      // eslint-disable-next-line no-console
      console.log('[DeepSeekReasoning] prompt messages count:', params.prompt.length);

      // 检查所有消息的内容结构
      for (let i = 0; i < params.prompt.length; i++) {
        const msg = params.prompt[i] as any;
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          const partTypes = msg.content.map((p: any) => p.type);
          // eslint-disable-next-line no-console
          console.log(`[DeepSeekReasoning] Assistant message ${i} part types:`, partTypes);

          // 检查是否有 reasoning parts
          const reasoningParts = msg.content.filter((p: any) => p.type === 'reasoning');
          if (reasoningParts.length > 0) {
            // eslint-disable-next-line no-console
            console.log(`[DeepSeekReasoning] Found ${reasoningParts.length} reasoning parts in message ${i}`);
            for (const rp of reasoningParts) {
              // eslint-disable-next-line no-console
              console.log(`[DeepSeekReasoning] Reasoning text length: ${rp.text?.length || 0}`);
            }
          }
        }
      }

      // 检查是否有 reasoning parts
      const hasReasoning = params.prompt.some(
        (msg: any) =>
          msg.role === 'assistant' &&
          Array.isArray(msg.content) &&
          msg.content.some((p: any) => p.type === 'reasoning')
      );

      // eslint-disable-next-line no-console
      console.log('[DeepSeekReasoning] hasReasoning=%s', hasReasoning);

      if (!hasReasoning) return params;

      const transformedPrompt = params.prompt.map((message: any, idx: number) => {
        if (message.role !== 'assistant') return message;
        if (!Array.isArray(message.content)) return message;

        // 查找 reasoning parts
        const reasoningParts = message.content.filter(
          (part: any) => part.type === 'reasoning'
        );

        if (reasoningParts.length === 0) return message;

        // 提取 reasoning 文本
        const reasoningText = reasoningParts
          .map((part: any) => part.text || '')
          .filter(Boolean)
          .join('\n');

        if (!reasoningText) return message;

        // eslint-disable-next-line no-console
        console.log(`[DeepSeekReasoning] Converting reasoning to think tags for message ${idx}, length=${reasoningText.length}`);

        // 将 reasoning 内容以 <think> 标签内联到 text part 中
        const newContent: any[] = [];
        let textMerged = false;

        for (const part of message.content) {
          if ((part as any).type === 'reasoning') {
            // 跳过 reasoning parts，后面会合并到 text 中
            continue;
          }
          if ((part as any).type === 'text' && !textMerged) {
            // 将 reasoning 内容前置到第一个 text part
            newContent.push({
              ...part,
              text: `<think>\n${reasoningText}\n</think>\n${(part as any).text}`,
            });
            textMerged = true;
          } else {
            newContent.push(part);
          }
        }

        // 如果没有 text part 但有 reasoning，创建一个包含 reasoning 的 text part
        if (!textMerged && reasoningText) {
          newContent.push({
            type: 'text',
            text: `<think>\n${reasoningText}\n</think>`,
          });
        }

        // eslint-disable-next-line no-console
        console.log(`[DeepSeekReasoning] Transformed message ${idx}: ${message.content.length} parts -> ${newContent.length} parts`);

        return { ...message, content: newContent };
      });

      return {
        ...params,
        prompt: transformedPrompt,
      };
    },
  };
}
