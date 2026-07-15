import {
  createStreamingTextDisplayBuffer,
  isAgentStreamAbortError,
  type StreamingTextDisplayBuffer
} from '@baishou/shared'
export interface SessionStreamState {
  text: string
  reasoning: string
  isStreaming: boolean
  isCompressing: boolean
  compressionPhase: 'auto' | 'manual'
  compressionText: string
  compressionReasoning: string
  compressionTriggerMessageId: string | null
  activeTool: { name: string; args: any } | null
  completedTools: ToolExecution[]
  pendingEmojis: PendingEmoji[]
  error: string | null
  activeToolStartTime?: number
  isBridgeActive: boolean
}

export interface ToolExecution {
  name: string
  startTime: number
  durationMs: number
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

export function markAgentStreamUserStopped(sessionId: string | undefined): void {
  if (sessionId) userStoppedSessions.add(sessionId)
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
  state.completedTools = []
  state.activeTool = null
  state.activeToolStartTime = undefined
  state.pendingEmojis = []
}

/** 消息列表已从 DB 刷新后清除桥接态，避免 StreamingBubble 与 ChatBubble 短暂并存 */
export function clearStreamBridgeForSession(sessionId: string): void {
  resetStreamDisplayBuffers(sessionId)
  updateSessionState(sessionId, (state) => {
    clearStreamBridgeState(state)
  })
}

export function getOrCreateSessionState(sessionId: string): SessionStreamState {
  if (!sessionStates[sessionId]) {
    sessionStates[sessionId] = {
      text: '',
      reasoning: '',
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
      isBridgeActive: false
    }
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
    ensureStreamTextDisplayBuffer(sId).push(chunk ?? '')
  }

  const onReasoningChunk = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    const chunk = typeof payload === 'object' ? payload?.chunk : payload
    if (!sId || userStoppedSessions.has(sId)) return
    ensureStreamReasoningDisplayBuffer(sId).push(chunk ?? '')
  }

  const onToolStart = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    if (!sId || userStoppedSessions.has(sId)) return
    const name = typeof payload === 'object' ? payload?.name : payload?.name
    const args = typeof payload === 'object' ? payload?.args : payload?.args
    // emoji_send 工具：即时将表情包加入 pendingEmojis（在流式文本之前显示）
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
          state.pendingEmojis.push({ emojiId })
        })
      }
      return
    }
    updateSessionState(sId, (state) => {
      state.activeToolStartTime = Date.now()
      state.activeTool = { name, args }
    })
  }

  const onToolResult = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    if (!sId || userStoppedSessions.has(sId)) return
    const name = typeof payload === 'object' ? payload?.name : payload?.name
    // emoji_send 工具不在流式阶段显示工具卡片（表情包已作为 pendingEmojis 即时显示）
    if (name === 'emoji_send') return
    updateSessionState(sId, (state) => {
      const start = state.activeToolStartTime || Date.now()
      const durationMs = Date.now() - start
      state.completedTools.push({ name, startTime: start, durationMs })
      state.activeTool = null
    })
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
      resetStreamDisplayBuffers(sId)
    }
    updateSessionState(sId, (state) => {
      state.isStreaming = false
      // 用户取消后不要因残留 buffer 重新点亮 bridge
      state.isBridgeActive = userStopped ? false : Boolean(fullText.trim() || fullReasoning.trim())
      if (!userStopped && payload?.error && !isAgentStreamAbortError(payload.error)) {
        state.error = payload.error
      } else {
        state.error = null
      }
      state.activeTool = null
    })

    if (userStopped) return

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

  return () => {
    window.removeEventListener('baishou:compression-stream-reset', onCompressionStreamReset)
    clearAgentStreamIpcListeners(ipc)
  }
}

let globalStreamIpcRegistered = false

export function ensureGlobalStreamIpcListeners(): void {
  if (globalStreamIpcRegistered) return
  if (typeof window === 'undefined' || !window.electron?.ipcRenderer) return
  registerGlobalStreamIpcListeners()
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
}
