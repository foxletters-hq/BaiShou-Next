/**
 * 中间件工厂 — 根据 Provider 类型自动组装中间件链
 *
 * 所有中间件的注册和管理都集中在这里。
 * Client 无需直接 import 具体的中间件类，只需通过此工厂获取。
 *
 * 原始实现：lib/agent/middleware/middleware_factory.dart (36 行)
 */

import { MiddlewareChain } from './message-middleware';
import type { MessageMiddleware } from './message-middleware';
import { GeminiThoughtSignatureMiddleware } from './gemini-thought-signature';

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'custom';

/**
 * 根据 Provider 类型构建对应的中间件链
 */
export function buildMiddlewareChain(providerType: ProviderType): MiddlewareChain {
  const middlewares: MessageMiddleware[] = [];

  switch (providerType) {
    case 'gemini':
      middlewares.push(new GeminiThoughtSignatureMiddleware());
      // 未来: GeminiSafetySettingsMiddleware, ...
      break;

    case 'anthropic':
      // 未来: AnthropicCacheMiddleware, ...
      break;

    case 'openai':
    case 'deepseek':
    case 'custom':
    default:
      // OpenAI 标准协议族 (OpenAI, DeepSeek, Kimi, GLM 等)
      break;
  }

  return new MiddlewareChain(middlewares);
}
