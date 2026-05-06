/**
 * 消息中间件抽象接口 + 中间件链
 *
 * 中间件作用在 [消息列表 → API 请求体] 的转换阶段，
 * 对已构建好的 provider-specific contents 列表做后处理。
 *
 * 原始实现：lib/agent/middleware/message_middleware.dart (33 行)
 */

import type { ModelMessage } from 'ai';

/**
 * 消息中间件接口
 */
export interface MessageMiddleware {
  /** 中间件名称（用于调试日志） */
  readonly name: string;

  /**
   * 处理消息列表
   * 
   * @param messages Vercel AI SDK 格式的消息列表
   * @returns 处理后的消息列表
   */
  process(messages: ModelMessage[]): ModelMessage[];
}

/**
 * 中间件链 — 按顺序执行多个中间件
 */
export class MiddlewareChain {
  private readonly middlewares: MessageMiddleware[];

  constructor(middlewares: MessageMiddleware[]) {
    this.middlewares = middlewares;
  }

  /** 依次执行所有中间件 */
  apply(messages: ModelMessage[]): ModelMessage[] {
    let result = messages;
    for (const mw of this.middlewares) {
      result = mw.process(result);
    }
    return result;
  }

  get isEmpty(): boolean {
    return this.middlewares.length === 0;
  }
}
