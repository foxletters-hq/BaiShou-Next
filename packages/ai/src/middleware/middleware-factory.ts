/**
 * 中间件工厂 — 根据 Provider 类型自动组装中间件链
 *
 * 所有中间件的注册和管理都集中在这里。
 * Client 无需直接 import 具体的中间件类，只需通过此工厂获取。
 *
 * 原始实现：lib/agent/middleware/middleware_factory.dart (36 行)
 */

import { MiddlewareChain } from './message-middleware'
import type { MessageMiddleware } from './message-middleware'
import { GeminiThoughtSignatureMiddleware } from './gemini-thought-signature'
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai'
import type { LanguageModelV3Middleware } from '@ai-sdk/provider'
import { createDeepSeekReasoningMiddleware } from './deepseek-reasoning'
import { logger } from '@baishou/shared'

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'custom'

/**
 * 根据 Provider 类型构建对应的中间件链
 */
export function buildMiddlewareChain(providerType: ProviderType): MiddlewareChain {
  const middlewares: MessageMiddleware[] = []

  switch (providerType) {
    case 'gemini':
      middlewares.push(new GeminiThoughtSignatureMiddleware())
      // 未来: GeminiSafetySettingsMiddleware, ...
      break

    case 'anthropic':
      // 未来: AnthropicCacheMiddleware, ...
      break

    case 'deepseek':
      // DeepSeek reasoning 中间件已通过 Vercel AI SDK 的 LanguageModelV3Middleware 实现
      // 参见 ./deepseek-reasoning.ts
      break

    case 'openai':
    case 'custom':
    default:
      // OpenAI 标准协议族 (OpenAI, DeepSeek, Kimi, GLM 等)
      break
  }

  return new MiddlewareChain(middlewares)
}

/**
 * 根据 Provider 类型构建对应的 Vercel AI SDK LanguageModelV3Middleware 列表
 */
export function buildLanguageModelMiddlewares(providerType: string): LanguageModelV3Middleware[] {
  const middlewares: LanguageModelV3Middleware[] = []

  // 1. DeepSeek reasoning 内容处理中间件 — 将历史消息中的 reasoning parts 转换为 <think> 标签
  //    解决 DeepSeek API 要求回传 reasoning_content 的问题
  if (providerType === 'deepseek') {
    try {
      middlewares.push(createDeepSeekReasoningMiddleware())
    } catch (e: any) {
      logger.warn(
        '[buildLanguageModelMiddlewares] createDeepSeekReasoningMiddleware not available:',
        e
      )
    }
  }

  // 2. 推理提取中间件 — 适用于 DeepSeek-R1、QwQ 等在文本中嵌入 <think> 标签的模型
  if (providerType === 'deepseek' || providerType === 'openai') {
    try {
      middlewares.push(extractReasoningMiddleware({ tagName: 'think' }) as any)
    } catch (e: any) {
      logger.warn('[buildLanguageModelMiddlewares] extractReasoningMiddleware not available:', e)
    }
  }

  return middlewares
}

/**
 * 自动使用对应 Provider 的中间件包装基础语言模型
 */
export function wrapLanguageModelWithMiddlewares(model: any, providerType: string): any {
  const middlewares = buildLanguageModelMiddlewares(providerType)
  if (middlewares.length > 0) {
    return wrapLanguageModel({
      model: model as any,
      middleware: middlewares
    })
  }
  return model
}
