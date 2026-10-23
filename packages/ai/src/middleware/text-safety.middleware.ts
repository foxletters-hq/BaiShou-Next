/**
 * 文本安全中间件 — 在请求发送前清理孤立 UTF-16 代理项。
 *
 * 截断工具输出、拼接外部 MCP 结果或用户粘贴内容时，字符串里可能残留
 * 半个 emoji（孤立高/低代理）。`JSON.stringify` 会将其输出为 `\ud83d`，
 * 而 DeepSeek 等服务端的严格 JSON 解析器会报
 * `unexpected end of hex escape` 并返回 400。
 *
 * 这里对 prompt / system / tools 做一次深度清理，覆盖所有 Provider 与调用入口。
 */

import type { LanguageModelV3Middleware } from '@ai-sdk/provider'
import { sanitizeSurrogatesDeep } from '@baishou/shared'

type ParamsWithSystem = Record<string, unknown> & {
  prompt?: unknown
  system?: unknown
  tools?: unknown
}

export function createTextSafetyMiddleware(): LanguageModelV3Middleware {
  return {
    specificationVersion: 'v3' as const,
    transformParams: async ({ params }) => {
      const source = params as unknown as ParamsWithSystem
      let changed = false
      const next: ParamsWithSystem = { ...source }

      for (const key of ['prompt', 'system', 'tools'] as const) {
        const value = source[key]
        if (value === undefined) continue
        const sanitized = sanitizeSurrogatesDeep(value)
        if (sanitized !== value) {
          next[key] = sanitized
          changed = true
        }
      }

      return (changed ? next : params) as typeof params
    }
  }
}
