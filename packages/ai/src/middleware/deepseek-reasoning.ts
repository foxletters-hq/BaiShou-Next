/**
 * DeepSeek Reasoning Content 中间件
 *
 * DeepSeek thinking 模式要求后续请求回传 reasoning_content。
 * @ai-sdk/openai 的 convertToOpenAIChatMessages 会丢掉 reasoning parts，
 * 因此先把 reasoning 内联为标签，再由 fetch 拦截提取为 reasoning_content。
 *
 * 标签使用 redacted_thinking，与 applyDeepSeekReasoningFields 一致。
 */

import type { LanguageModelV3Middleware } from '@ai-sdk/provider'

const THINK_OPEN = '<' + 'redacted_thinking>'
const THINK_CLOSE = '<' + '/redacted_thinking>'

/**
 * 创建 DeepSeek reasoning 内容处理中间件。
 * 将 assistant 消息中的 reasoning parts 转换为 redacted_thinking 标签内联到 text 中。
 */
export function createDeepSeekReasoningMiddleware(): LanguageModelV3Middleware {
  return {
    specificationVersion: 'v3' as const,
    transformParams: async ({ params }) => {
      if (!params.prompt) return params

      const hasReasoning = params.prompt.some(
        (msg: any) =>
          msg.role === 'assistant' &&
          Array.isArray(msg.content) &&
          msg.content.some((p: any) => p.type === 'reasoning')
      )

      if (!hasReasoning) return params

      const transformedPrompt = params.prompt.map((message: any) => {
        if (message.role !== 'assistant') return message
        if (!Array.isArray(message.content)) return message

        const reasoningParts = message.content.filter((part: any) => part.type === 'reasoning')
        if (reasoningParts.length === 0) return message

        const reasoningText = reasoningParts
          .map((part: any) => part.text || '')
          .filter(Boolean)
          .join('\n')

        const newContent: any[] = []
        let textMerged = false

        for (const part of message.content) {
          if ((part as any).type === 'reasoning') continue
          if ((part as any).type === 'text' && !textMerged) {
            const prefix = reasoningText
              ? `${THINK_OPEN}\n${reasoningText}\n${THINK_CLOSE}\n`
              : `${THINK_OPEN}${THINK_CLOSE}\n`
            newContent.push({
              ...part,
              text: `${prefix}${(part as any).text}`
            })
            textMerged = true
          } else {
            newContent.push(part)
          }
        }

        if (!textMerged) {
          newContent.push({
            type: 'text',
            text: reasoningText
              ? `${THINK_OPEN}\n${reasoningText}\n${THINK_CLOSE}`
              : `${THINK_OPEN}${THINK_CLOSE}`
          })
        }

        return { ...message, content: newContent }
      })

      return {
        ...params,
        prompt: transformedPrompt
      }
    }
  }
}
