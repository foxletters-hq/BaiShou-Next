/**
 * StreamChunkAdapter — 统一的流式 Chunk 适配器
 *
 * 职责：
 * 1. 消费 Vercel AI SDK 的 fullStream (TextStreamPart)
 * 2. 将原始事件映射为应用层标准化的 StreamChunk
 * 3. 通过 onChunk 回调实时推送给消费方（IPC / UI）
 * 4. 采集性能指标（TTFT / TPS）
 *
 * 替代了原来 consumeAndPersistStream 里散落的 if/else 逻辑。
 */

import type { StreamTextResult } from 'ai';
import { ChunkType, type StreamChunk, type StreamMetrics } from './stream-chunk.types';
import { StreamAccumulator } from './stream-accumulator';

export interface StreamChunkAdapterCallbacks {
  onChunk?: (chunk: StreamChunk) => void;
}

export class StreamChunkAdapter {
  private accumulator: StreamAccumulator;
  private callbacks: StreamChunkAdapterCallbacks;

  // ─── 性能指标追踪 ───
  private streamStartTime: number = 0;
  private firstTokenTime: number | null = null;

  constructor(
    accumulator: StreamAccumulator,
    callbacks: StreamChunkAdapterCallbacks = {}
  ) {
    this.accumulator = accumulator;
    this.callbacks = callbacks;
  }

  /**
   * 消费 Vercel AI SDK 的 fullStream 并通过 onChunk 推送标准化 Chunk。
   * 
   * @returns 流执行过程中遇到的致命错误（如果有），null 表示正常结束。
   */
  async consumeStream(streamResult: StreamTextResult<any, any>): Promise<{ error: any | null }> {
    if (!streamResult.fullStream) {
      return { error: null };
    }

    this.streamStartTime = Date.now();
    this.firstTokenTime = null;

    const reader = streamResult.fullStream.getReader();
    let fatalError: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 交给累积器保存进度
        this.accumulator.add(value);

        // 将原始 AI SDK 事件映射为标准化 Chunk
        const chunk = this.mapToChunk(value);
        if (chunk) {
          // 标记首 Token 时间
          if (
            this.firstTokenTime === null &&
            (chunk.type === ChunkType.TEXT_DELTA || chunk.type === ChunkType.REASONING_DELTA)
          ) {
            this.firstTokenTime = Date.now();
          }

          this.callbacks.onChunk?.(chunk);
        }
      }
    } catch (e) {
      fatalError = e;
      this.callbacks.onChunk?.({
        type: ChunkType.ERROR,
        error: e,
      });
    } finally {
      reader.releaseLock();
    }

    return { error: fatalError };
  }

  /**
   * 获取性能指标
   */
  getMetrics(): StreamMetrics {
    const now = Date.now();
    const totalDuration = Math.max(now - this.streamStartTime, 1);
    const timeToFirstToken = this.firstTokenTime
      ? Math.max(this.firstTokenTime - this.streamStartTime, 0)
      : totalDuration;

    const outputTokens = this.accumulator.usage.outputTokens;
    // 去除 TTFT 后的纯生成时间计算 TPS
    const generationTime = Math.max(totalDuration - timeToFirstToken, 1);
    const tokensPerSecond = outputTokens > 0 ? (outputTokens / generationTime) * 1000 : 0;

    return {
      timeToFirstToken,
      totalDuration,
      tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
    };
  }

  /**
   * 将 Vercel AI SDK 的原始 TextStreamPart 映射为应用层 StreamChunk。
   * 返回 null 表示当前事件不需要推送给消费方。
   */
  private mapToChunk(part: any): StreamChunk | null {
    switch (part.type) {
      case 'text-delta': {
        const text = part.textDelta || part.text || '';
        if (!text) return null;
        return { type: ChunkType.TEXT_DELTA, text };
      }

      case 'reasoning-delta': {
        const text = part.textDelta || part.text || '';
        if (!text) return null;
        return { type: ChunkType.REASONING_DELTA, text };
      }

      case 'tool-call': {
        return {
          type: ChunkType.TOOL_CALL,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input ?? part.args ?? {},
        };
      }

      case 'tool-result': {
        return {
          type: ChunkType.TOOL_RESULT,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: part.output ?? part.result,
        };
      }

      case 'error': {
        return { type: ChunkType.ERROR, error: part.error };
      }

      case 'abort': {
        return { type: ChunkType.ABORT };
      }

      case 'finish-step': {
        return {
          type: ChunkType.STEP_FINISH,
          finishReason: part.finishReason || 'unknown',
          usage: part.usage
            ? {
                inputTokens: part.usage.inputTokens || part.usage.promptTokens || 0,
                outputTokens: part.usage.outputTokens || part.usage.completionTokens || 0,
              }
            : undefined,
        };
      }

      case 'finish': {
        const u = part.totalUsage || part.usage;
        return {
          type: ChunkType.FINISH,
          usage: u
            ? {
                inputTokens: u.inputTokens || u.promptTokens || 0,
                outputTokens: u.outputTokens || u.completionTokens || 0,
              }
            : undefined,
        };
      }

      default:
        // 其他类型（如 text-start、text-end、reasoning-start 等）
        // 不需要显式推送，accumulator 已经处理了
        return null;
    }
  }
}
