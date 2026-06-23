import { useEffect, useState, useCallback, useRef, useContext } from 'react'
import { MainPageCacheActiveContext } from '../../../layouts/main-page-cache.context'

export interface ToolExecution {
  name: string
  startTime: number
  durationMs: number
}

export interface UseAgentStreamResult {
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
  error: string | null
  /** 流已结束、DB 消息尚未刷新时，继续展示 StreamingBubble 避免闪断或重复气泡 */
  isBridgeActive: boolean
  saveUserMessage: (
    sessionId: string,
    text: string,
    attachments?: any[]
  ) => Promise<{ userMessageId: string; attachments?: any[] } | { error: string }>
  startChat: (
    sessionId: string,
    text: string,
    providerId?: string,
    modelId?: string,
    attachments?: any[],
    searchMode?: boolean,
    userMsgId?: string
  ) => Promise<void>
  editChat: (
    sessionId: string,
    messageId: string,
    text: string,
    providerId?: string,
    modelId?: string,
    attachments?: any[],
    searchMode?: boolean
  ) => Promise<void>
  resendChat: (
    sessionId: string,
    messageId: string,
    searchMode?: boolean,
    providerId?: string,
    modelId?: string
  ) => Promise<void>
  stopChat: () => void
  reset: () => void
}

interface SessionStreamState {
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
  error: string | null
  activeToolStartTime?: number
  isBridgeActive: boolean
}

// ── 全局多会话流状态存储 ──
const sessionStates: Record<string, SessionStreamState> = {}
const sessionListeners: Record<string, Set<() => void>> = {}
const COMPRESSION_DELTA_RENDER_INTERVAL_MS = 80
const STREAM_DELTA_RENDER_INTERVAL_MS = 50
const compressionDeltaNotifyTimers: Record<string, ReturnType<typeof setTimeout> | undefined> = {}
const streamDeltaNotifyTimers: Record<string, ReturnType<typeof setTimeout> | undefined> = {}

function clearCompressionStreamState(state: SessionStreamState): void {
  state.isCompressing = false
  state.compressionText = ''
  state.compressionReasoning = ''
  state.compressionTriggerMessageId = null
}

function clearStreamBridgeState(state: SessionStreamState): void {
  state.isBridgeActive = false
  state.text = ''
  state.reasoning = ''
  state.completedTools = []
  state.activeTool = null
  state.activeToolStartTime = undefined
}

/** 消息列表已从 DB 刷新后清除桥接态，避免 StreamingBubble 与 ChatBubble 短暂并存 */
export function clearStreamBridgeForSession(sessionId: string): void {
  updateSessionState(sessionId, (state) => {
    clearStreamBridgeState(state)
  })
}

function getOrCreateSessionState(sessionId: string): SessionStreamState {
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

function scheduleCompressionDeltaNotify(sessionId: string) {
  if (compressionDeltaNotifyTimers[sessionId]) return

  compressionDeltaNotifyTimers[sessionId] = setTimeout(() => {
    compressionDeltaNotifyTimers[sessionId] = undefined
    notifySessionListeners(sessionId)
  }, COMPRESSION_DELTA_RENDER_INTERVAL_MS)
}

function scheduleStreamDeltaNotify(sessionId: string) {
  if (streamDeltaNotifyTimers[sessionId]) return

  streamDeltaNotifyTimers[sessionId] = setTimeout(() => {
    streamDeltaNotifyTimers[sessionId] = undefined
    notifySessionListeners(sessionId)
  }, STREAM_DELTA_RENDER_INTERVAL_MS)
}

function updateSessionState(
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
    if (!sId) return
    updateSessionState(
      sId,
      (state) => {
        state.text += chunk
      },
      { notify: false }
    )
    scheduleStreamDeltaNotify(sId)
  }

  const onReasoningChunk = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    const chunk = typeof payload === 'object' ? payload?.chunk : payload
    if (!sId) return
    updateSessionState(
      sId,
      (state) => {
        state.reasoning += chunk
      },
      { notify: false }
    )
    scheduleStreamDeltaNotify(sId)
  }

  const onToolStart = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    if (!sId) return
    const name = typeof payload === 'object' ? payload?.name : payload?.name
    const args = typeof payload === 'object' ? payload?.args : payload?.args
    updateSessionState(sId, (state) => {
      state.activeToolStartTime = Date.now()
      state.activeTool = { name, args }
    })
  }

  const onToolResult = (_: unknown, payload: any) => {
    const sId = typeof payload === 'object' ? payload?.sessionId : null
    if (!sId) return
    const name = typeof payload === 'object' ? payload?.name : payload?.name
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
    if (streamDeltaNotifyTimers[sId]) {
      clearTimeout(streamDeltaNotifyTimers[sId])
      streamDeltaNotifyTimers[sId] = undefined
    }
    updateSessionState(sId, (state) => {
      state.isStreaming = false
      state.isBridgeActive = Boolean(state.text.trim() || state.reasoning.trim())
      if (payload?.error) {
        state.error = payload.error
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
  }

  const onCompressionEvent = (_: unknown, event: any) => {
    const sId = event?.sessionId
    if (!sId || !event?.type) return

    if (event.type === 'reasoning-delta' || event.type === 'delta') {
      updateSessionState(
        sId,
        (state) => {
          if (event.type === 'reasoning-delta') {
            state.compressionReasoning += event.chunk ?? ''
          } else {
            state.compressionText += event.chunk ?? ''
          }
        },
        { notify: false }
      )
      scheduleCompressionDeltaNotify(sId)
    } else {
      updateSessionState(sId, (state) => {
        if (event.type === 'start') {
          state.isCompressing = true
          state.compressionPhase = event.phase === 'manual' ? 'manual' : 'auto'
          state.compressionText = ''
          state.compressionReasoning = ''
          state.compressionTriggerMessageId =
            typeof event.triggerUserMessageId === 'string' ? event.triggerUserMessageId : null
        } else if (event.type === 'finish') {
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
    ipc.removeListener('agent:stream-chunk', onStreamChunk)
    ipc.removeListener('agent:reasoning-chunk', onReasoningChunk)
    ipc.removeListener('agent:tool-start', onToolStart)
    ipc.removeListener('agent:tool-result', onToolResult)
    ipc.removeListener('agent:stream-finish', onStreamFinish)
    ipc.removeListener('agent:compression-event', onCompressionEvent)
    window.removeEventListener('baishou:compression-stream-reset', onCompressionStreamReset)
    clearAgentStreamIpcListeners(ipc)
  }
}

let globalStreamIpcRegistered = false

function ensureGlobalStreamIpcListeners(): void {
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
  for (const key of Object.keys(streamDeltaNotifyTimers)) {
    const timer = streamDeltaNotifyTimers[key]
    if (timer) clearTimeout(timer)
    delete streamDeltaNotifyTimers[key]
  }
  for (const key of Object.keys(compressionDeltaNotifyTimers)) {
    const timer = compressionDeltaNotifyTimers[key]
    if (timer) clearTimeout(timer)
    delete compressionDeltaNotifyTimers[key]
  }
}

export function useAgentStream(currentSessionId?: string): UseAgentStreamResult {
  const [, setVersion] = useState(0)
  const sessionIdRef = useRef(currentSessionId)
  const isPageActive = useContext(MainPageCacheActiveContext)

  useEffect(() => {
    sessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // 订阅当前活动会话的更新，并在其变化时强制 React 重新渲染
  useEffect(() => {
    if (!currentSessionId) return

    if (!sessionListeners[currentSessionId]) {
      sessionListeners[currentSessionId] = new Set()
    }

    const forceUpdate = () => {
      setVersion((v) => v + 1)
    }
    sessionListeners[currentSessionId].add(forceUpdate)
    forceUpdate()

    return () => {
      if (sessionListeners[currentSessionId]) {
        sessionListeners[currentSessionId].delete(forceUpdate)
      }
    }
  }, [currentSessionId])

  // 页面从后台恢复时同步最新流式状态
  useEffect(() => {
    if (isPageActive && currentSessionId) {
      setVersion((v) => v + 1)
    }
  }, [isPageActive, currentSessionId])

  // 全局唯一的一组 IPC 监听器：负责分发所有来自后端的流数据到对应 sessionStates
  useEffect(() => {
    ensureGlobalStreamIpcListeners()
  }, [])

  const saveUserMessage = useCallback(
    async (
      sessionId: string,
      userText: string,
      attachments?: any[]
    ): Promise<{ userMessageId: string; attachments?: any[] } | { error: string }> => {
      const result = await window.electron.ipcRenderer.invoke('agent:save-user-message', {
        sessionId,
        text: userText,
        attachments
      })
      return result
    },
    []
  )

  const startChat = useCallback(
    async (
      sessionId: string,
      userText: string,
      providerId?: string,
      modelId?: string,
      attachments?: any[],
      searchMode?: boolean,
      userMsgId?: string
    ): Promise<void> => {
      updateSessionState(sessionId, (state) => {
        state.isStreaming = true
        state.isBridgeActive = false
        state.isCompressing = false
        state.error = null
        state.activeTool = null
        state.completedTools = []
        state.text = ''
        state.reasoning = ''
        state.activeToolStartTime = undefined
        clearCompressionStreamState(state)
      })

      await window.electron.ipcRenderer.invoke('agent:chat', {
        sessionId,
        text: userText,
        providerId,
        modelId,
        attachments,
        searchMode,
        userMsgId
      })
    },
    []
  )

  const editChat = useCallback(
    async (
      sessionId: string,
      messageId: string,
      userText: string,
      providerId?: string,
      modelId?: string,
      attachments?: any[],
      searchMode?: boolean
    ) => {
      updateSessionState(sessionId, (state) => {
        state.isStreaming = true
        state.isBridgeActive = false
        state.isCompressing = false
        state.error = null
        state.activeTool = null
        state.completedTools = []
        state.text = ''
        state.reasoning = ''
        state.activeToolStartTime = undefined
        clearCompressionStreamState(state)
      })

      await window.electron.ipcRenderer.invoke(
        'agent:edit-message',
        sessionId,
        messageId,
        userText,
        providerId,
        modelId,
        attachments,
        searchMode
      )
    },
    []
  )

  const resendChat = useCallback(
    async (
      sessionId: string,
      messageId: string,
      searchMode?: boolean,
      providerId?: string,
      modelId?: string
    ) => {
      updateSessionState(sessionId, (state) => {
        state.isStreaming = true
        state.isBridgeActive = false
        state.isCompressing = false
        state.error = null
        state.activeTool = null
        state.completedTools = []
        state.text = ''
        state.reasoning = ''
        state.activeToolStartTime = undefined
        clearCompressionStreamState(state)
      })

      await window.electron.ipcRenderer.invoke(
        'agent:resend',
        sessionId,
        messageId,
        searchMode,
        providerId,
        modelId
      )
    },
    []
  )

  const stopChat = useCallback(() => {
    const sessionId = currentSessionId
    if (sessionId) {
      if (streamDeltaNotifyTimers[sessionId]) {
        clearTimeout(streamDeltaNotifyTimers[sessionId])
        streamDeltaNotifyTimers[sessionId] = undefined
      }
      if (compressionDeltaNotifyTimers[sessionId]) {
        clearTimeout(compressionDeltaNotifyTimers[sessionId])
        compressionDeltaNotifyTimers[sessionId] = undefined
      }
      updateSessionState(sessionId, (state) => {
        state.isStreaming = false
        state.isBridgeActive = false
        state.isCompressing = false
        state.activeTool = null
        clearCompressionStreamState(state)
        clearStreamBridgeState(state)
      })
    }
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer
        .invoke('agent:stop-stream', sessionId)
        .catch(console.error)
    }
  }, [currentSessionId])

  const reset = useCallback(() => {
    if (!currentSessionId) return
    updateSessionState(currentSessionId, (state) => {
      state.error = null
      state.isStreaming = false
      state.isBridgeActive = false
      state.isCompressing = false
      state.compressionText = ''
      state.compressionReasoning = ''
      state.compressionTriggerMessageId = null
      clearStreamBridgeState(state)
    })
  }, [currentSessionId])

  const activeState = currentSessionId
    ? getOrCreateSessionState(currentSessionId)
    : {
        text: '',
        reasoning: '',
        isStreaming: false,
        isCompressing: false,
        compressionPhase: 'auto' as const,
        compressionText: '',
        compressionReasoning: '',
        compressionTriggerMessageId: null,
        activeTool: null,
        completedTools: [],
        error: null,
        isBridgeActive: false
      }

  return {
    text: activeState.text,
    reasoning: activeState.reasoning,
    isStreaming: activeState.isStreaming,
    isBridgeActive: activeState.isBridgeActive,
    isCompressing: activeState.isCompressing,
    compressionPhase: activeState.compressionPhase,
    compressionText: activeState.compressionText,
    compressionReasoning: activeState.compressionReasoning,
    compressionTriggerMessageId: activeState.compressionTriggerMessageId,
    activeTool: activeState.activeTool,
    completedTools: activeState.completedTools,
    error: activeState.error,
    saveUserMessage,
    startChat,
    editChat,
    resendChat,
    stopChat,
    reset
  }
}
