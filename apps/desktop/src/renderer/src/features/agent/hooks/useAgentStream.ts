import { useEffect, useState, useCallback, useRef } from 'react'

export interface ToolExecution {
  name: string
  startTime: number
  durationMs: number
}

export interface UseAgentStreamResult {
  text: string
  reasoning: string
  isStreaming: boolean
  activeTool: { name: string; args: any } | null
  completedTools: ToolExecution[]
  error: string | null
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
  reset: () => void
}

interface SessionStreamState {
  text: string
  reasoning: string
  isStreaming: boolean
  activeTool: { name: string; args: any } | null
  completedTools: ToolExecution[]
  error: string | null
  activeToolStartTime?: number
}

// ── 全局多会话流状态存储 ──
const sessionStates: Record<string, SessionStreamState> = {}
const sessionListeners: Record<string, Set<() => void>> = {}

function getOrCreateSessionState(sessionId: string): SessionStreamState {
  if (!sessionStates[sessionId]) {
    sessionStates[sessionId] = {
      text: '',
      reasoning: '',
      isStreaming: false,
      activeTool: null,
      completedTools: [],
      error: null
    }
  }
  return sessionStates[sessionId]
}

function updateSessionState(sessionId: string, updater: (state: SessionStreamState) => void) {
  const state = getOrCreateSessionState(sessionId)
  updater(state)
  if (sessionListeners[sessionId]) {
    sessionListeners[sessionId].forEach((listener) => listener())
  }
}

export function useAgentStream(currentSessionId?: string): UseAgentStreamResult {
  const [, setVersion] = useState(0)
  const sessionIdRef = useRef(currentSessionId)

  useEffect(() => {
    sessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // 订阅当前活动会话的更新，并在其变化时强制 React 重新渲染
  useEffect(() => {
    if (!currentSessionId) return

    if (!sessionListeners[currentSessionId]) {
      sessionListeners[currentSessionId] = new Set()
    }

    const forceUpdate = () => setVersion((v) => v + 1)
    sessionListeners[currentSessionId].add(forceUpdate)

    return () => {
      if (sessionListeners[currentSessionId]) {
        sessionListeners[currentSessionId].delete(forceUpdate)
      }
    }
  }, [currentSessionId])

  // 全局唯一的一组 IPC 监听器：负责分发所有来自后端的流数据到对应 sessionStates
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron || !window.electron.ipcRenderer) return

    if ((window as any).__baishou_stream_registered) return
    ;(window as any).__baishou_stream_registered = true

    window.electron.ipcRenderer.on('agent:stream-chunk', (_, payload: any) => {
      const sId = typeof payload === 'object' ? payload?.sessionId : null
      const chunk = typeof payload === 'object' ? payload?.chunk : payload
      if (!sId) return

      updateSessionState(sId, (state) => {
        state.text += chunk
      })
    })

    window.electron.ipcRenderer.on('agent:reasoning-chunk', (_, payload: any) => {
      const sId = typeof payload === 'object' ? payload?.sessionId : null
      const chunk = typeof payload === 'object' ? payload?.chunk : payload
      if (!sId) return

      console.log('[Renderer Stream] Reasoning Chunk:', JSON.stringify(chunk))
      updateSessionState(sId, (state) => {
        state.reasoning += chunk
      })
    })

    window.electron.ipcRenderer.on('agent:tool-start', (_, payload: any) => {
      const sId = typeof payload === 'object' ? payload?.sessionId : null
      if (!sId) return
      const name = typeof payload === 'object' ? payload?.name : payload?.name
      const args = typeof payload === 'object' ? payload?.args : payload?.args

      updateSessionState(sId, (state) => {
        state.activeToolStartTime = Date.now()
        state.activeTool = { name, args }
      })
    })

    window.electron.ipcRenderer.on('agent:tool-result', (_, payload: any) => {
      const sId = typeof payload === 'object' ? payload?.sessionId : null
      if (!sId) return
      const name = typeof payload === 'object' ? payload?.name : payload?.name

      updateSessionState(sId, (state) => {
        const start = state.activeToolStartTime || Date.now()
        const durationMs = Date.now() - start
        state.completedTools.push({ name, startTime: start, durationMs })
        state.activeTool = null
      })
    })

    window.electron.ipcRenderer.on('agent:stream-finish', (_, payload: any) => {
      const sId = typeof payload === 'object' ? payload?.sessionId : null
      if (!sId) return

      updateSessionState(sId, (state) => {
        state.isStreaming = false
        if (payload?.error) {
          state.error = payload.error
        }
        state.activeTool = null
      })
    })
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
        state.error = null
        state.activeTool = null
        state.completedTools = []
        state.text = ''
        state.reasoning = ''
        state.activeToolStartTime = undefined
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
        state.error = null
        state.activeTool = null
        state.completedTools = []
        state.text = ''
        state.reasoning = ''
        state.activeToolStartTime = undefined
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
        state.error = null
        state.activeTool = null
        state.completedTools = []
        state.text = ''
        state.reasoning = ''
        state.activeToolStartTime = undefined
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

  const reset = useCallback(() => {
    if (!currentSessionId) return
    updateSessionState(currentSessionId, (state) => {
      state.text = ''
      state.reasoning = ''
      state.error = null
      state.isStreaming = false
      state.activeTool = null
      state.completedTools = []
      state.activeToolStartTime = undefined
    })
  }, [currentSessionId])

  const activeState = currentSessionId
    ? getOrCreateSessionState(currentSessionId)
    : {
        text: '',
        reasoning: '',
        isStreaming: false,
        activeTool: null,
        completedTools: [],
        error: null
      }

  return {
    text: activeState.text,
    reasoning: activeState.reasoning,
    isStreaming: activeState.isStreaming,
    activeTool: activeState.activeTool,
    completedTools: activeState.completedTools,
    error: activeState.error,
    saveUserMessage,
    startChat,
    editChat,
    resendChat,
    reset
  }
}
