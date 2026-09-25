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

import type { StreamTextResult } from 'ai'
import { parseCompanionAskStreamArgs } from '../tools/companion-ask-stream.util'
import { ChunkType, type StreamChunk, type StreamMetrics } from './stream-chunk.types'
import { StreamAccumulator } from './stream-accumulator'
import { isAgentStreamAbortError, logger } from '@baishou/shared'
import { isNoOutputGeneratedError } from './no-output-generated-error.util'
import { isAgentStreamFirstOutputChunk } from './agent-stream-timeout'

function readToolCallIds(part: {
  id?: unknown
  toolCallId?: unknown
}): { canonical: string; aliases: string[] } {
  const toolCallId = String(part.toolCallId ?? '').trim()
  const id = String(part.id ?? '').trim()
  const aliases = [...new Set([toolCallId, id].filter((value) => value.length > 0))]
  return { canonical: aliases[0] ?? '', aliases }
}

function readToolInputDelta(part: { delta?: unknown; inputTextDelta?: unknown }): string {
  if (typeof part.delta === 'string' && part.delta) return part.delta
  if (typeof part.inputTextDelta === 'string') return part.inputTextDelta
  return ''
}

export interface StreamChunkAdapterCallbacks {
  onChunk?: (chunk: StreamChunk) => void
}

export class StreamChunkAdapter {
  private accumulator: StreamAccumulator
  private callbacks: StreamChunkAdapterCallbacks

  // ─── 性能指标追踪 ───
  private streamStartTime: number = 0
  private firstTokenTime: number | null = null
  private readonly toolNames = new Map<string, string>()
  private readonly canonicalCallIds = new Map<string, string>()
  private readonly argBuffers = new Map<string, string>()
  private readonly forwardedAsks = new Set<string>()

  constructor(accumulator: StreamAccumulator, callbacks: StreamChunkAdapterCallbacks = {}) {
    this.accumulator = accumulator
    this.callbacks = callbacks
  }

  private rememberCallId(ids: { canonical: string; aliases: string[] }): string {
    const known =
      this.canonicalCallIds.get(ids.canonical) ??
      ids.aliases.map((alias) => this.canonicalCallIds.get(alias)).find((value) => Boolean(value))
    const canonical = known || ids.canonical
    for (const alias of ids.aliases) {
      this.canonicalCallIds.set(alias, canonical)
    }
    this.canonicalCallIds.set(canonical, canonical)
    return canonical
  }

  private resolveCallId(ids: { canonical: string; aliases: string[] }): string {
    return (
      this.canonicalCallIds.get(ids.canonical) ??
      ids.aliases.map((alias) => this.canonicalCallIds.get(alias)).find((value) => Boolean(value)) ??
      ids.canonical
    )
  }

  /**
   * 消费 Vercel AI SDK 的 fullStream 并通过 onChunk 推送标准化 Chunk。
   *
   * @returns 流执行过程中遇到的致命错误（如果有），null 表示正常结束。
   */
  async consumeStream(
    streamResult: StreamTextResult<any, any, any>,
    options?: { onFirstOutput?: () => void }
  ): Promise<{ error: any | null }> {
    if (!streamResult.fullStream) {
      return { error: null }
    }

    this.streamStartTime = Date.now()
    this.firstTokenTime = null

    const reader = streamResult.fullStream.getReader()
    let fatalError: any = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        if ((value as { type?: string }).type === 'error') {
          const err = (value as { error?: unknown }).error ?? value
          if (!isNoOutputGeneratedError(err)) {
            fatalError = err instanceof Error ? err : new Error(String(err))
          }
        }

        // 用户主动取消：SDK 可能以 abort 事件结束，而非抛 AbortError
        if ((value as { type?: string }).type === 'abort') {
          fatalError = new DOMException('The operation was aborted', 'AbortError')
        }

        // 交给累积器保存进度
        this.accumulator.add(value)

        // 将原始 AI SDK 事件映射为标准化 Chunk
        const chunk = this.mapToChunk(value)
        if (chunk) {
          // 标记首 Token 时间
          if (
            this.firstTokenTime === null &&
            (chunk.type === ChunkType.TEXT_DELTA || chunk.type === ChunkType.REASONING_DELTA)
          ) {
            this.firstTokenTime = Date.now()
          }
          if (isAgentStreamFirstOutputChunk(chunk.type)) {
            options?.onFirstOutput?.()
          }

          this.callbacks.onChunk?.(chunk)
        }
      }
    } catch (e: any) {
      // AI_NoOutputGeneratedError 在 agent tool-call 场景中是正常的
      // 模型只返回工具调用而没有文本时会触发此错误，不应阻止后续计费和持久化
      if (isAgentStreamAbortError(e)) {
        fatalError =
          e instanceof Error ? e : new DOMException('The operation was aborted', 'AbortError')
      } else if (isNoOutputGeneratedError(e)) {
        logger.info(
          '[StreamChunkAdapter] AI_NoOutputGeneratedError detected (normal for tool-call only responses), treating as non-fatal'
        )
      } else {
        fatalError = e
        this.callbacks.onChunk?.({
          type: ChunkType.ERROR,
          error: e
        })
      }
    } finally {
      reader.releaseLock()
    }

    return { error: fatalError }
  }

  /**
   * 获取性能指标
   */
  getMetrics(): StreamMetrics {
    const now = Date.now()
    const totalDuration = Math.max(now - this.streamStartTime, 1)
    const timeToFirstToken = this.firstTokenTime
      ? Math.max(this.firstTokenTime - this.streamStartTime, 0)
      : totalDuration

    const outputTokens = this.accumulator.usage.outputTokens
    // 去除 TTFT 后的纯生成时间计算 TPS
    const generationTime = Math.max(totalDuration - timeToFirstToken, 1)
    const tokensPerSecond = outputTokens > 0 ? (outputTokens / generationTime) * 1000 : 0

    return {
      timeToFirstToken,
      totalDuration,
      tokensPerSecond: Math.round(tokensPerSecond * 10) / 10
    }
  }

  /**
   * 将 Vercel AI SDK 的原始 TextStreamPart 映射为应用层 StreamChunk。
   * 返回 null 表示当前事件不需要推送给消费方。
   */
  private mapToChunk(part: any): StreamChunk | null {
    switch (part.type) {
      case 'text-delta': {
        const text = part.textDelta || part.text || ''
        if (!text) return null
        return { type: ChunkType.TEXT_DELTA, text }
      }

      case 'reasoning-delta': {
        const text = part.textDelta || part.text || ''
        if (!text) return null
        return { type: ChunkType.REASONING_DELTA, text }
      }

      case 'tool-input-start':
      case 'tool-call': {
        const toolName = String(part.toolName ?? '').trim()
        const ids = readToolCallIds(part)
        if (!toolName || !ids.canonical) return null
        const canonical = this.rememberCallId(ids)
        this.toolNames.set(canonical, toolName)
        for (const alias of ids.aliases) {
          this.toolNames.set(alias, toolName)
        }
        const partial = part.type === 'tool-input-start'
        return {
          type: ChunkType.TOOL_CALL,
          toolCallId: canonical,
          toolName,
          input: part.input ?? part.args ?? {},
          ...(partial ? { partial: true } : {})
        }
      }

      case 'tool-input-delta': {
        const ids = readToolCallIds(part)
        const delta = readToolInputDelta(part)
        const canonical = this.resolveCallId(ids)
        if (!canonical || !delta || this.forwardedAsks.has(canonical)) return null
        const toolName = this.toolNames.get(canonical)
        if (toolName !== 'companion_ask') return null
        const next = (this.argBuffers.get(canonical) ?? '') + delta
        this.argBuffers.set(canonical, next)
        const parsed = parseCompanionAskStreamArgs(next)
        if (!parsed) return null
        this.forwardedAsks.add(canonical)
        return {
          type: ChunkType.TOOL_CALL,
          toolCallId: canonical,
          toolName,
          input: parsed
        }
      }

      case 'tool-result': {
        const toolName = String(part.toolName ?? '').trim()
        if (!toolName) return null
        return {
          type: ChunkType.TOOL_RESULT,
          toolCallId: part.toolCallId,
          toolName,
          output: part.output ?? part.result
        }
      }

      case 'error': {
        if (isNoOutputGeneratedError(part.error ?? part)) return null
        return { type: ChunkType.ERROR, error: part.error }
      }

      case 'abort': {
        return { type: ChunkType.ABORT }
      }

      case 'finish-step': {
        return {
          type: ChunkType.STEP_FINISH,
          finishReason: part.finishReason || 'unknown',
          usage: part.usage
            ? {
                inputTokens: part.usage.inputTokens || part.usage.promptTokens || 0,
                outputTokens: part.usage.outputTokens || part.usage.completionTokens || 0
              }
            : undefined
        }
      }

      case 'finish': {
        const u = part.totalUsage || part.usage
        return {
          type: ChunkType.FINISH,
          usage: u
            ? {
                inputTokens: u.inputTokens || u.promptTokens || 0,
                outputTokens: u.outputTokens || u.completionTokens || 0
              }
            : undefined
        }
      }

      default:
        // 其他类型（如 text-start、text-end、reasoning-start 等）
        // 不需要显式推送，accumulator 已经处理了
        return null
    }
  }
}
