import type {
  AgentSessionRuntimeEvent,
  AgentSessionRuntimeListener,
  SessionRuntimeToolPayloadSummary
} from '@baishou/shared'
import { ChunkType, type StreamChunk } from './stream-chunk.types'

const listeners = new Set<AgentSessionRuntimeListener>()

/** 控制面工具 IO 预览上限（字符） */
export const SESSION_RUNTIME_TOOL_PREVIEW_MAX_CHARS = 200

/** 订阅 Agent 会话运行时事件（桌面 IPC 桥接 / 测试 / 后续 UI 消费共用） */
export function onAgentSessionRuntime(listener: AgentSessionRuntimeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitAgentSessionRuntime(event: AgentSessionRuntimeEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      /* ignore listener errors */
    }
  }
}

/** 单次流式会话的内存事件记录器，供调试与后续消费 */
export class AgentSessionRuntimeRecorder {
  private readonly events: AgentSessionRuntimeEvent[] = []

  record(event: AgentSessionRuntimeEvent): void {
    this.events.push(event)
    emitAgentSessionRuntime(event)
  }

  getEvents(): readonly AgentSessionRuntimeEvent[] {
    return this.events
  }

  clear(): void {
    this.events.length = 0
  }
}

export interface SessionRuntimeBridgeState {
  stepIndex: number
  stepStarted: boolean
}

export function createSessionRuntimeBridgeState(): SessionRuntimeBridgeState {
  return { stepIndex: 0, stepStarted: false }
}

function runtimeTimestamp(): number {
  return Date.now()
}

function isToolResultFailure(output: unknown): string | null {
  if (output instanceof Error) return output.message
  if (typeof output === 'object' && output !== null) {
    const record = output as Record<string, unknown>
    if (record.isError === true) {
      return typeof record.error === 'string' ? record.error : 'tool error'
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error
    }
  }
  return null
}

function stringifyToolPayload(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** 将工具 input/output 压缩为控制面摘要（全量 UI 仍走 sendToolStart/Result） */
export function summarizeToolPayloadForRuntime(
  value: unknown,
  maxChars: number = SESSION_RUNTIME_TOOL_PREVIEW_MAX_CHARS
): SessionRuntimeToolPayloadSummary {
  const raw = stringifyToolPayload(value)
  const charLength = raw.length
  const truncated = charLength > maxChars
  const preview = truncated ? raw.slice(0, maxChars) : raw
  const summary: SessionRuntimeToolPayloadSummary = {
    preview,
    truncated,
    charLength
  }
  if (truncated) {
    summary.byteLength = new TextEncoder().encode(raw).length
  }
  return summary
}

/**
 * 将标准化 StreamChunk 映射为会话运行时事件。
 * 维护 stepIndex / stepStarted 状态，供 AgentSessionService 在 onChunk 中调用。
 * 工具 IO 仅保留摘要；全量展示仍由 UI emitter 通道负责。
 */
export function bridgeStreamChunkToRuntimeEvents(
  sessionId: string,
  chunk: StreamChunk,
  state: SessionRuntimeBridgeState
): AgentSessionRuntimeEvent[] {
  const timestamp = runtimeTimestamp()
  const events: AgentSessionRuntimeEvent[] = []

  const ensureStepStarted = () => {
    if (state.stepStarted) return
    state.stepStarted = true
    events.push({
      type: 'session.step_started',
      sessionId,
      stepIndex: state.stepIndex,
      timestamp
    })
  }

  switch (chunk.type) {
    case ChunkType.TEXT_DELTA:
    case ChunkType.REASONING_DELTA:
      ensureStepStarted()
      break

    case ChunkType.TOOL_CALL:
      ensureStepStarted()
      events.push({
        type: 'session.tool_started',
        sessionId,
        stepIndex: state.stepIndex,
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        input: summarizeToolPayloadForRuntime(chunk.input),
        timestamp
      })
      break

    case ChunkType.TOOL_RESULT: {
      const toolError = isToolResultFailure(chunk.output)
      if (toolError) {
        events.push({
          type: 'session.tool_failed',
          sessionId,
          stepIndex: state.stepIndex,
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          error: toolError,
          timestamp
        })
      } else {
        events.push({
          type: 'session.tool_completed',
          sessionId,
          stepIndex: state.stepIndex,
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          output: summarizeToolPayloadForRuntime(chunk.output),
          timestamp
        })
      }
      break
    }

    case ChunkType.STEP_FINISH:
      events.push({
        type: 'session.step_ended',
        sessionId,
        stepIndex: state.stepIndex,
        finishReason: chunk.finishReason,
        usage: chunk.usage,
        timestamp
      })
      state.stepIndex += 1
      state.stepStarted = false
      break

    case ChunkType.ERROR:
      events.push({
        type: 'session.step_failed',
        sessionId,
        stepIndex: state.stepIndex,
        error: chunk.error instanceof Error ? chunk.error.message : String(chunk.error),
        timestamp
      })
      break

    case ChunkType.ABORT:
      events.push({
        type: 'session.interrupted',
        sessionId,
        reason: 'aborted',
        timestamp
      })
      break

    case ChunkType.FINISH:
      break
  }

  return events
}

export function recordRuntimeEvents(
  recorder: AgentSessionRuntimeRecorder,
  events: AgentSessionRuntimeEvent[]
): void {
  for (const event of events) {
    recorder.record(event)
  }
}

/** 测试专用：重置全局监听器 */
export function resetAgentSessionRuntimeForTests(): void {
  listeners.clear()
}
