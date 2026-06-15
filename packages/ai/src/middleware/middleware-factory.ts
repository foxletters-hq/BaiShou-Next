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
import { createPromptCachingMiddleware } from './prompt-caching.middleware'
import type { PromptCachingContext } from './prompt-caching.types'
import { logger } from '@baishou/shared'

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'custom'

export interface WrapLanguageModelOptions {
  providerType: string
  providerId?: string
  modelId?: string
  sessionId?: string
  baseUrl?: string
}

function resolveWrapOptions(
  options: string | WrapLanguageModelOptions
): WrapLanguageModelOptions {
  if (typeof options === 'string') {
    return { providerType: options }
  }
  return options
}

function toCachingContext(options: WrapLanguageModelOptions): PromptCachingContext {
  return {
    providerType: options.providerType,
    providerId: options.providerId,
    modelId: options.modelId,
    sessionId: options.sessionId,
    baseUrl: options.baseUrl,
    cachePolicy: 'auto'
  }
}

/**
 * 根据 Provider 类型构建对应的中间件链
 */
export function buildMiddlewareChain(providerType: ProviderType): MiddlewareChain {
  const middlewares: MessageMiddleware[] = []

  switch (providerType) {
    case 'gemini':
      middlewares.push(new GeminiThoughtSignatureMiddleware())
      break

    case 'anthropic':
    case 'deepseek':
    case 'openai':
    case 'custom':
    default:
      break
  }

  return new MiddlewareChain(middlewares)
}

/**
 * 根据 Provider 类型构建对应的 Vercel AI SDK LanguageModelV3Middleware 列表
 */
export function buildLanguageModelMiddlewares(
  options: string | WrapLanguageModelOptions
): LanguageModelV3Middleware[] {
  const resolved = resolveWrapOptions(options)
  const middlewares: LanguageModelV3Middleware[] = []

  // 0. 提示词缓存 — 默认开启，覆盖所有厂商
  middlewares.push(createPromptCachingMiddleware(toCachingContext(resolved)))

  // 1. DeepSeek reasoning 内容处理中间件
  if (resolved.providerType === 'deepseek') {
    try {
      middlewares.push(createDeepSeekReasoningMiddleware())
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e)
      logger.warn(
        '[buildLanguageModelMiddlewares] createDeepSeekReasoningMiddleware not available:',
        detail
      )
    }
  }

  // 2. 推理提取中间件
  if (resolved.providerType === 'deepseek' || resolved.providerType === 'openai') {
    try {
      middlewares.push(extractReasoningMiddleware({ tagName: 'think' }) as LanguageModelV3Middleware)
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e)
      logger.warn('[buildLanguageModelMiddlewares] extractReasoningMiddleware not available:', detail)
    }
  }

  return middlewares
}

/**
 * 自动使用对应 Provider 的中间件包装基础语言模型
 */
export function wrapLanguageModelWithMiddlewares(
  model: unknown,
  options: string | WrapLanguageModelOptions
): any {
  const middlewares = buildLanguageModelMiddlewares(options)
  if (middlewares.length > 0) {
    return wrapLanguageModel({
      model: model as Parameters<typeof wrapLanguageModel>[0]['model'],
      middleware: middlewares
    })
  }
  return model
}

export { buildCachedSystemForStream } from './prompt-caching.util'
export type { PromptCachingContext, PromptCachePolicy } from './prompt-caching.types'
