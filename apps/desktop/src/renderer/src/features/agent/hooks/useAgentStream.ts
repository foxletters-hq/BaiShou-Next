import { useEffect, useState, useCallback, useRef, useContext } from 'react'
import type { AgentGateReply, AgentGateRequest } from '@baishou/shared'
import { selectActivePendingForSession, useAgentGateInboxStore } from '@baishou/store'
import { MainPageCacheActiveContext } from '../../../layouts/main-page-cache.context'
import { ensureDesktopAgentGateInboxBridge } from '../agent-gate-inbox-bridge'
import {
  ensureGlobalStreamIpcListeners,
  sessionListeners,
  updateSessionState,
  resetStreamDisplayBuffers,
  flushStreamDisplayBuffers,
  flushCompressionDisplayBuffers,
  resetCompressionDisplayBuffers,
  clearCompressionStreamState,
  clearStreamBridgeState,
  getOrCreateSessionState,
  markAgentStreamUserStopped,
  type ToolExecution,
  type PendingEmoji
} from './agent-stream-session-store'

export {
  clearStreamBridgeForSession,
  finishStreamingSession,
  __resetAgentStreamIpcForTests
} from './agent-stream-session-store'
export type { ToolExecution, PendingEmoji } from './agent-stream-session-store'

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
  /** 流式期间收到的 emoji_send 表情包，即时显示为图片 */
  pendingEmojis: PendingEmoji[]
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
  beginStreaming: (sessionId: string) => void
  pendingAgentGate: AgentGateRequest | null
  isAgentGateReplying: boolean
  replyAgentGate: (input: {
    requestId: string
    reply: AgentGateReply
    message?: string
    selectedOptionIds?: string[]
  }) => Promise<void>
}

export function useAgentStream(currentSessionId?: string): UseAgentStreamResult {
  const [, setVersion] = useState(0)
  const sessionIdRef = useRef(currentSessionId)
  const isPageActive = useContext(MainPageCacheActiveContext)
  const pendingAgentGate = useAgentGateInboxStore((state) =>
    selectActivePendingForSession(state, currentSessionId)
  )

  useEffect(() => {
    sessionIdRef.current = currentSessionId
  }, [currentSessionId])

  useEffect(() => {
    ensureDesktopAgentGateInboxBridge()
  }, [])

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
      resetStreamDisplayBuffers(sessionId)
      updateSessionState(sessionId, (state) => {
        state.isStreaming = true
        state.isBridgeActive = false
        state.isCompressing = false
        state.error = null
        state.activeTool = null
        state.completedTools = []
        state.pendingEmojis = []
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
      resetStreamDisplayBuffers(sessionId)
      updateSessionState(sessionId, (state) => {
        state.isStreaming = true
        state.isBridgeActive = false
        state.isCompressing = false
        state.error = null
        state.activeTool = null
        state.completedTools = []
        state.pendingEmojis = []
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
      resetStreamDisplayBuffers(sessionId)
      updateSessionState(sessionId, (state) => {
        state.isStreaming = true
        state.isBridgeActive = false
        state.isCompressing = false
        state.error = null
        state.activeTool = null
        state.completedTools = []
        state.pendingEmojis = []
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

  const beginStreaming = useCallback((sessionId: string): void => {
    resetStreamDisplayBuffers(sessionId)
    updateSessionState(sessionId, (state) => {
      state.isStreaming = true
      state.isBridgeActive = false
      state.isCompressing = false
      state.error = null
      state.activeTool = null
      state.completedTools = []
      state.pendingEmojis = []
      state.text = ''
      state.reasoning = ''
      state.activeToolStartTime = undefined
      state.pendingAgentGate = null
      state.isAgentGateReplying = false
      clearCompressionStreamState(state)
    })
  }, [])

  const replyAgentGate = useCallback(
    async (input: {
      requestId: string
      reply: AgentGateReply
      message?: string
      selectedOptionIds?: string[]
    }): Promise<void> => {
      const sessionId = currentSessionId ?? sessionIdRef.current
      if (sessionId) {
        updateSessionState(sessionId, (state) => {
          state.isAgentGateReplying = true
        })
      }

      try {
        await window.api.agentGate.reply(input)
        useAgentGateInboxStore.getState().removeReplied(input.requestId)
        if (sessionId) {
          updateSessionState(sessionId, (state) => {
            if (state.pendingAgentGate?.id === input.requestId) {
              state.pendingAgentGate = null
            }
            state.isAgentGateReplying = false
          })
        }
      } catch (error) {
        if (sessionId) {
          updateSessionState(sessionId, (state) => {
            state.isAgentGateReplying = false
          })
        }
        throw error
      }
    },
    [currentSessionId]
  )

  const stopChat = useCallback(() => {
    const sessionId = currentSessionId
    if (sessionId) {
      markAgentStreamUserStopped(sessionId)
      flushStreamDisplayBuffers(sessionId)
      flushCompressionDisplayBuffers(sessionId)
      resetStreamDisplayBuffers(sessionId)
      updateSessionState(sessionId, (state) => {
        state.isStreaming = false
        state.isBridgeActive = false
        state.isCompressing = false
        state.error = null
        state.activeTool = null
        clearCompressionStreamState(state)
        clearStreamBridgeState(state)
      })
    }
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer.invoke('agent:stop-stream', sessionId).catch(console.error)
    }
  }, [currentSessionId])

  const reset = useCallback(() => {
    if (!currentSessionId) return
    resetStreamDisplayBuffers(currentSessionId)
    resetCompressionDisplayBuffers(currentSessionId)
    updateSessionState(currentSessionId, (state) => {
      state.error = null
      state.isStreaming = false
      state.isBridgeActive = false
      state.isCompressing = false
      state.compressionText = ''
      state.compressionReasoning = ''
      state.compressionTriggerMessageId = null
      state.pendingAgentGate = null
      state.isAgentGateReplying = false
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
        pendingEmojis: [],
        error: null,
        isBridgeActive: false,
        pendingAgentGate: null,
        isAgentGateReplying: false
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
    pendingEmojis: activeState.pendingEmojis,
    error: activeState.error,
    pendingAgentGate,
    isAgentGateReplying: activeState.isAgentGateReplying,
    saveUserMessage,
    startChat,
    editChat,
    resendChat,
    stopChat,
    reset,
    beginStreaming,
    replyAgentGate
  }
}
