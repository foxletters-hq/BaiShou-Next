/* eslint-disable max-lines -- 多会话流状态与 IPC 桥接集中管理，拆分模块会引入循环依赖 */
import {
  appendTimelineReasoning,
  appendTimelineText,
  appendTimelineToolStart,
  completeTimelineTool,
  createStreamingTextDisplayBuffer,
  type AgentGateRequest,
  type AgentStreamTimelineItem,
  type StreamingTextDisplayBuffer
} from '@baishou/shared'
export interface SessionStreamState {
  text: string
  reasoning: string
  /** 按发生顺序的 reasoning / tool / text 片段（流式时间线） */
  timeline: AgentStreamTimelineItem[]
  isStreaming: boolean
  isCompressing: boolean
  compressionPhase: 'auto' | 'manual'
  compressionText: string
  compressionReasoning: string
  compressionTriggerMessageId: string | null
  activeTool: { name: string; args: any; callId?: string } | null
  completedTools: ToolExecution[]
  pendingEmojis: PendingEmoji[]
  error: string | null
  activeToolStartTime?: number
  isBridgeActive: boolean
  pendingAgentGate: AgentGateRequest | null
  isAgentGateReplying: boolean
}

export interface ToolExecution {
  name: string
  startTime: number
  durationMs: number
  callId?: string
}

export interface PendingEmoji {
  emojiId: string
}

/** 桌面 Agent + XMarkdown：每个 chunk 立即透传全文，流式 Markdown 由 XMarkdown 负责 */
const DESKTOP_AGENT_STREAM_DISPLAY_OPTIONS = {
  immediate: true
} as const

// ── 全局多会话流状态存储 ──
const sessionStates: Record<string, SessionStreamState> = {}
export const sessionListeners: Record<string, Set<() => void>> = {}
const streamTextDisplayBuffers: Record<string, StreamingTextDisplayBuffer> = {}
const streamReasoningDisplayBuffers: Record<string, StreamingTextDisplayBuffer> = {}
const compressionTextDisplayBuffers: Record<string, StreamingTextDisplayBuffer> = {}
const compressionReasoningDisplayBuffers: Record<string, StreamingTextDisplayBuffer> = {}
/** 用户点击停止后，忽略随后迟到的 stream-finish 错误（避免「取消成功」后又弹失败） */
const userStoppedSessions = new Set<string>()
const hydratingSessions = new Set<string>()

export function markAgentStreamUserStopped(sessionId: string | undefined): void {
  if (sessionId) userStoppedSessions.add(sessionId)
}

/**
 * 页面热重载 / 刷新后，从主进程恢复正在进行中的会话流快照，
 * 避免渲染进程刷新后状态丢失而主进程仍在继续输出。
 */
export async function hydrateSessionStreamFromMain(sessionId: string | undefined): Promise<void> {
  if (!sessionId || userStoppedSessions.has(sessionId) || hydratingSessions.has(sessionId)) return
  if (typeof window === 'undefined' || !window.electron?.ipcRenderer?.invoke) return

  hydratingSessions.add(sessionId)
  try {
    const snap = await window.electron.ipcRenderer.invoke('agent:get-active-stream', sessionId)
    if (!snap || !snap.isStreaming || userStoppedSessions.has(sessionId)) return

    if (typeof snap.text === 'string' && snap.text.length > 0) {
      const buf = ensureStreamTextDisplayBuffer(sessionId)
      if (snap.text.length > buf.getFullText().length) {
        buf.reset()
        buf.push(snap.text)
        buf.flush()
      }
    }
    if (typeof snap.reasoning === 'string' && snap.reasoning.length > 0) {
      const buf = ensureStreamReasoningDisplayBuffer(sessionId)
      if (snap.reasoning.length > buf.getFullText().length) {
        buf.reset()
        buf.push(snap.reasoning)
        buf.flush()
      }
    }

    updateSessionState(sessionId, (state) => {
      state.isStreaming = true
      state.isBridgeActive = false
      if (typeof snap.text === 'string' && snap.text.length >= state.text.length) {
        state.text = snap.text
      }
      if (typeof snap.reasoning === 'string' && snap.reasoning.length >= state.reasoning.length) {
        state.reasoning = snap.reasoning
      }
      if (Array.isArray(snap.timeline) && snap.timeline.length >= state.timeline.length) {
        state.timeline = snap.timeline
      }
      if (snap.activeTool && !state.activeTool) {
        state.activeTool = snap.activeTool
        state.activeToolStartTime = snap.activeToolStartTime
      }
      if (
        Array.isArray(snap.completedTools) &&
        snap.completedTools.length >= state.completedTools.length
      ) {
        state.completedTools = snap.completedTools
      }
      if (
        Array.isArray(snap.pendingEmojis) &&
        snap.pendingEmojis.length >= state.pendingEmojis.length
      ) {
        state.pendingEmojis = snap.pendingEmojis
      }
    })
  } catch {
    // 忽略测试环境或旧通道未注册时的调用异常
  } finally {
    hydratingSessions.delete(sessionId)
  }
}

function ensureStreamTextDisplayBuffer(sessionId: string): StreamingTextDisplayBuffer {
  if (!streamTextDisplayBuffers[sessionId]) {
    streamTextDisplayBuffers[sessionId] = createStreamingTextDisplayBuffer((text) => {
      updateSessionState(
        sessionId,
        (state) => {
          state.text = text
        },
        { notify: false }
      )
      notifySessionListeners(sessionId)
    }, DESKTOP_AGENT_STREAM_DISPLAY_OPTIONS)
  }
  return streamTextDisplayBuffers[sessionId]
}

function ensureStreamReasoningDisplayBuffer(sessionId: string): StreamingTextDisplayBuffer {
  if (!streamReasoningDisplayBuffers[sessionId]) {
    streamReasoningDisplayBuffers[sessionId] = createStreamingTextDisplayBuffer((text) => {
      updateSessionState(
        sessionId,
        (state) => {
          state.reasoning = text
        },
        { notify: false }
      )
      notifySessionListeners(sessionId)
    }, DESKTOP_AGENT_STREAM_DISPLAY_OPTIONS)
  }
  return streamReasoningDisplayBuffers[sessionId]
}

function ensureCompressionTextDisplayBuffer(sessionId: string): StreamingTextDisplayBuffer {
  if (!compressionTextDisplayBuffers[sessionId]) {
    compressionTextDisplayBuffers[sessionId] = createStreamingTextDisplayBuffer((text) => {
      updateSessionState(
        sessionId,
        (state) => {
          state.compressionText = text
        },
        { notify: false }
      )
      notifySessionListeners(sessionId)
    })
  }
  return compressionTextDisplayBuffers[sessionId]
}

function ensureCompressionReasoningDisplayBuffer(sessionId: string): StreamingTextDisplayBuffer {
  if (!compressionReasoningDisplayBuffers[sessionId]) {
    compressionReasoningDisplayBuffers[sessionId] = createStreamingTextDisplayBuffer((text) => {
      updateSessionState(
        sessionId,
        (state) => {
          state.compressionReasoning = text
        },
        { notify: false }
      )
      notifySessionListeners(sessionId)
    })
  }
  return compressionReasoningDisplayBuffers[sessionId]
}

export function resetStreamDisplayBuffers(sessionId: string): void {
  ensureStreamTextDisplayBuffer(sessionId).reset()
  ensureStreamReasoningDisplayBuffer(sessionId).reset()
}

export function flushStreamDisplayBuffers(sessionId: string): void {
  streamTextDisplayBuffers[sessionId]?.flush()
  streamReasoningDisplayBuffers[sessionId]?.flush()
}

export function resetCompressionDisplayBuffers(sessionId: string): void {
  compressionTextDisplayBuffers[sessionId]?.reset()
  compressionReasoningDisplayBuffers[sessionId]?.reset()
}

export function flushCompressionDisplayBuffers(sessionId: string): void {
  compressionTextDisplayBuffers[sessionId]?.flush()
  compressionReasoningDisplayBuffers[sessionId]?.flush()
}

export function clearCompressionStreamState(state: SessionStreamState): void {
  state.isCompressing = false
  state.compressionText = ''
  state.compressionReasoning = ''
  state.compressionTriggerMessageId = null
}

export function clearStreamBridgeState(state: SessionStreamState): void {
  state.isBridgeActive = false
  state.text = ''
  state.reasoning = ''
  state.timeline = []
  state.completedTools = []
  state.activeTool = null
  state.activeToolStartTime = undefined
  state.pendingEmojis = []
  state.pendingAgentGate = null
  state.isAgentGateReplying = false
}

/** 消息列表已从 DB 刷新后清除桥接态，避免 StreamingBubble 与 ChatBubble 短暂并存 */
export function clearStreamBridgeForSession(sessionId: string): void {
  resetStreamDisplayBuffers(sessionId)
  updateSessionState(sessionId, (state) => {
    clearStreamBridgeState(state)
  })
}

/**
 * Workspace chat invoke 结束后的本地收尾（与 agent:stream-finish 幂等）。
 * 不清 bridge 文本，留给消息刷新后的 clearStreamBridge*。
 */
export function finishStreamingSession(sessionId: string): void {
  flushStreamDisplayBuffers(sessionId)
  flushCompressionDisplayBuffers(sessionId)
  updateSessionState(sessionId, (state) => {
    state.isStreaming = false
    state.isCompressing = false
    state.activeTool = null
    const hasContent = Boolean(
      state.text.trim() || state.reasoning.trim() || state.timeline.length > 0
    )
    if (!state.isBridgeActive) {
      state.isBridgeActive = hasContent
    }
  })
}

export function getOrCreateSessionState(sessionId: string): SessionStreamState {
  if (!sessionStates[sessionId]) {
    sessionStates[sessionId] = {
      text: '',
      reasoning: '',
      timeline: [],
      isStreaming: false,
      isCompressing: false,
      compressionPhase: 'auto',
      compressionText: '',
      compressionReasoning: '',
      compressionTriggerMessageId: null,
      activeTool: null,
      completedTools: [],
      pendingEmojis: [],
      error: null,
      isBridgeActive: false,
      pendingAgentGate: null,
      isAgentGateReplying: false
    }
  }
  if (!Array.isArray(sessionStates[sessionId].timeline)) {
    sessionStates[sessionId].timeline = []
  }
  return sessionStates[sessionId]
}

function notifySessionListeners(sessionId: string) {
  if (sessionListeners[sessionId]) {
    sessionListeners[sessionId].forEach((listener) => listener())
  }
}

export function updateSessionState(
  sessionId: string,
  updater: (state: SessionStreamState) => void,
  options?: { notify?: boolean }
) {
  const state = getOrCreateSessionState(sessionId)
  updater(state)
  if (options?.notify === false) {
    return
  }
  notifySessionListeners(sessionId)
}

const AGENT_STREAM_IPC_CHANNELS = [
  'agent:stream-chunk',
  'agent:reasoning-chunk',
  'agent:tool-start',
  'agent:tool-result',
  'agent:stream-finish',
  'agent:compression-event'
] as const

function clearAgentStreamIpcListeners(
  ipc: NonNullable<typeof window.electron>['ipcRenderer']
): void {
  for (const channel of AGENT_STREAM_IPC_CHANNELS) {
    ipc.removeAllListeners(channel)
  }
}

function registerGlobalStreamIpcListeners(): () => void {
  if (typeof window === 'undefined' || !window.electron?.ipcRenderer) {
    return () => {}
  }

  const ipc = window.electron.ipcRenderer
  clearAgentStreamIpcListeners(ipc)

  const onStreamChunk = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    const chunk = typeof payload === 'object' ? payload?.chunk : payload
    if (!sId || userStoppedSessions.has(sId)) return
    const delta = chunk ?? ''
    let needsHydrate = false
    updateSessionState(
      sId,
      (state) => {
        if (!state.isStreaming) {
          state.isStreaming = true
          state.isBridgeActive = false
          needsHydrate = true
        }
        appendTimelineText(state.timeline, delta)
      },
      { notify: false }
    )
    ensureStreamTextDisplayBuffer(sId).push(delta)
    if (needsHydrate) void hydrateSessionStreamFromMain(sId)
  }

  const onReasoningChunk = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    const chunk = typeof payload === 'object' ? payload?.chunk : payload
    if (!sId || userStoppedSessions.has(sId)) return
    const delta = chunk ?? ''
    let needsHydrate = false
    updateSessionState(
      sId,
      (state) => {
        if (!state.isStreaming) {
          state.isStreaming = true
          state.isBridgeActive = false
          needsHydrate = true
        }
        appendTimelineReasoning(state.timeline, delta)
      },
      { notify: false }
    )
    ensureStreamReasoningDisplayBuffer(sId).push(delta)
    if (needsHydrate) void hydrateSessionStreamFromMain(sId)
  }

  const onToolStart = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    if (!sId || userStoppedSessions.has(sId)) return
    const name = typeof payload === 'object' ? payload?.name : payload?.name
    const args = typeof payload === 'object' ? payload?.args : payload?.args
    const toolCallId =
      typeof payload === 'object' && typeof payload?.toolCallId === 'string'
        ? payload.toolCallId
        : `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // emoji_send 工具：先记下 pendingEmojis，流结束后再显示在正文之后
    if (name === 'emoji_send') {
      const emojiId =
        typeof args === 'object' && args !== null
          ? (args as Record<string, unknown>).emoji_id
          : typeof args === 'string'
            ? (() => {
                try {
                  const p = JSON.parse(args)
                  return p?.emoji_id
                } catch {
                  return args
                }
              })()
            : null
      if (typeof emojiId === 'string' && emojiId.length > 0) {
        updateSessionState(sId, (state) => {
          if (!state.isStreaming) {
            state.isStreaming = true
            state.isBridgeActive = false
          }
          state.pendingEmojis.push({ emojiId })
        })
      }
      return
    }
    let needsHydrate = false
    updateSessionState(sId, (state) => {
      if (!state.isStreaming) {
        state.isStreaming = true
        state.isBridgeActive = false
        needsHydrate = true
      }
      const start = Date.now()
      state.activeToolStartTime = start
      state.activeTool = { name, args, callId: toolCallId }
      appendTimelineToolStart(state.timeline, {
        callId: toolCallId,
        name,
        args,
        startTime: start
      })
    })
    if (needsHydrate) void hydrateSessionStreamFromMain(sId)
  }

  const onToolResult = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    if (!sId || userStoppedSessions.has(sId)) return
    const name = typeof payload === 'object' ? payload?.name : payload?.name
    const toolCallId =
      typeof payload === 'object' && typeof payload?.toolCallId === 'string'
        ? payload.toolCallId
        : undefined
    const result = typeof payload === 'object' ? payload?.result : undefined
    // emoji_send 工具不在流式阶段显示工具卡片（表情包已作为 pendingEmojis 即时显示）
    if (name === 'emoji_send') return
    let needsHydrate = false
    updateSessionState(sId, (state) => {
      if (!state.isStreaming) {
        state.isStreaming = true
        state.isBridgeActive = false
        needsHydrate = true
      }
      const start = state.activeToolStartTime || Date.now()
      const durationMs = Date.now() - start
      state.completedTools.push({ name, startTime: start, durationMs, callId: toolCallId })
      state.activeTool = null
      completeTimelineTool(state.timeline, { callId: toolCallId, name, result })
    })
    if (needsHydrate) void hydrateSessionStreamFromMain(sId)
  }

  const onStreamFinish = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    if (!sId) return
    flushStreamDisplayBuffers(sId)
    const fullText = streamTextDisplayBuffers[sId]?.getFullText() ?? ''
    const fullReasoning = streamReasoningDisplayBuffers[sId]?.getFullText() ?? ''
    const userStopped = userStoppedSessions.has(sId)
    if (userStopped) {
      userStoppedSessions.delete(sId)
    }
    updateSessionState(sId, (state) => {
      state.isStreaming = false
      const hasContent = Boolean(
        fullText.trim() || fullReasoning.trim() || state.timeline.length > 0
      )
      state.isBridgeActive = hasContent
      if (!userStopped && payload?.error) {
        state.error = payload.error
      } else {
        state.error = null
      }
      state.activeTool = null
    })

    if (payload?.messageId) {
      window.dispatchEvent(
        new CustomEvent('baishou:assistant-message-usage', {
          detail: {
            sessionId: sId,
            messageId: payload.messageId,
            inputTokens: payload.inputTokens,
            outputTokens: payload.outputTokens,
            cacheReadInputTokens: payload.cacheReadInputTokens,
            cacheWriteInputTokens: payload.cacheWriteInputTokens,
            costMicros: payload.costMicros
          }
        })
      )
    }

    window.dispatchEvent(
      new CustomEvent('baishou:agent-stream-finished', {
        detail: {
          sessionId: sId,
          messageId: payload?.messageId,
          error: payload?.error
        }
      })
    )
  }

  const onCompressionEvent = (_: unknown, event: any) => {
    const sId = event?.sessionId
    if (!sId || !event?.type) return

    if (event.type === 'reasoning-delta' || event.type === 'delta') {
      if (event.type === 'reasoning-delta') {
        ensureCompressionReasoningDisplayBuffer(sId).push(event.chunk ?? '')
      } else {
        ensureCompressionTextDisplayBuffer(sId).push(event.chunk ?? '')
      }
    } else {
      updateSessionState(sId, (state) => {
        if (event.type === 'start') {
          resetCompressionDisplayBuffers(sId)
          state.isCompressing = true
          state.compressionPhase = event.phase === 'manual' ? 'manual' : 'auto'
          state.compressionText = ''
          state.compressionReasoning = ''
          state.compressionTriggerMessageId =
            typeof event.triggerUserMessageId === 'string' ? event.triggerUserMessageId : null
        } else if (event.type === 'finish') {
          flushCompressionDisplayBuffers(sId)
          state.isCompressing = false
          state.compressionText = ''
          state.compressionReasoning = ''
          state.compressionTriggerMessageId = null
        }
      })
    }

    if (event.type === 'finish' && event.ok) {
      window.dispatchEvent(
        new CustomEvent('baishou:compression-finished', {
          detail: { sessionId: sId }
        })
      )
    }
  }

  const onCompressionStreamReset = (e: Event) => {
    const detail = (e as CustomEvent<{ sessionId?: string }>).detail
    const sId = detail?.sessionId
    if (!sId) return
    resetCompressionDisplayBuffers(sId)
    updateSessionState(sId, (state) => {
      state.compressionText = ''
      state.compressionReasoning = ''
      state.compressionTriggerMessageId = null
    })
  }

  ipc.on('agent:stream-chunk', onStreamChunk)
  ipc.on('agent:reasoning-chunk', onReasoningChunk)
  ipc.on('agent:tool-start', onToolStart)
  ipc.on('agent:tool-result', onToolResult)
  ipc.on('agent:stream-finish', onStreamFinish)
  ipc.on('agent:compression-event', onCompressionEvent)
  window.addEventListener('baishou:compression-stream-reset', onCompressionStreamReset)

  // pending Gate 队列由 agent-gate-inbox-bridge 统一维护；此处仅清理回复中状态
  const onAgentGateReplied = (payload: { sessionId?: string; requestId?: string }) => {
    const sId = payload?.sessionId
    if (!sId) return
    updateSessionState(sId, (state) => {
      state.isAgentGateReplying = false
      // 兼容旧字段：不再作为真相源
      if (state.pendingAgentGate?.id === payload.requestId) {
        state.pendingAgentGate = null
      }
    })
  }

  const unsubscribeReplied = window.api?.agentGate?.onReplied?.(onAgentGateReplied)

  return () => {
    window.removeEventListener('baishou:compression-stream-reset', onCompressionStreamReset)
    unsubscribeReplied?.()
    clearAgentStreamIpcListeners(ipc)
  }
}

let globalStreamIpcRegistered = false

export function ensureGlobalStreamIpcListeners(): void {
  if (globalStreamIpcRegistered) return
  if (typeof window === 'undefined' || !window.electron?.ipcRenderer) return
  registerGlobalStreamIpcListeners()
  // 动态 import 避免循环依赖；失败时忽略（App 层也会 ensure）
  void import('../agent-gate-inbox-bridge')
    .then((m) => m.ensureDesktopAgentGateInboxBridge())
    .catch(() => {})
  globalStreamIpcRegistered = true
}

/** @internal 仅供单测重置模块级 IPC 注册态 */
export function __resetAgentStreamIpcForTests(): void {
  if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
    clearAgentStreamIpcListeners(window.electron.ipcRenderer)
  }
  globalStreamIpcRegistered = false
  for (const key of Object.keys(sessionStates)) {
    delete sessionStates[key]
  }
  for (const key of Object.keys(sessionListeners)) {
    delete sessionListeners[key]
  }
  for (const key of Object.keys(streamTextDisplayBuffers)) {
    delete streamTextDisplayBuffers[key]
  }
  for (const key of Object.keys(streamReasoningDisplayBuffers)) {
    delete streamReasoningDisplayBuffers[key]
  }
  for (const key of Object.keys(compressionTextDisplayBuffers)) {
    delete compressionTextDisplayBuffers[key]
  }
  for (const key of Object.keys(compressionReasoningDisplayBuffers)) {
    delete compressionReasoningDisplayBuffers[key]
  }
  userStoppedSessions.clear()
}
