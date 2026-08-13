import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useAgentStream,
  finishStreamingSession,
  type UseAgentStreamResult
} from '../../agent/hooks/useAgentStream'

export interface StartWorkspaceChatResult {
  sessionId: string
  userMessageId: string
  createdNew: boolean
}

export interface WorkspaceToolError {
  name: string
  error: string
}

export interface UseWorkspaceAgentStreamResult extends UseAgentStreamResult {
  failedTools: WorkspaceToolError[]
  prepareWorkspaceTurn: (
    targetSessionId: string | undefined,
    text: string,
    folderRoot: string,
    options?: {
      assistantId?: string
      title?: string
      displayText?: string
      skillRefs?: Array<{ command: string; content: string }>
    }
  ) => Promise<StartWorkspaceChatResult>
  runWorkspaceChatStream: (
    sessionId: string,
    text: string,
    userMessageId: string,
    options?: {
      providerId?: string
      modelId?: string
      reasoningEffort?: string
      searchMode?: boolean
    }
  ) => Promise<void>
  /** @deprecated 使用 prepareWorkspaceTurn + runWorkspaceChatStream */
  startWorkspaceChat: (
    sessionId: string | undefined,
    text: string,
    folderRoot: string,
    options?: {
      assistantId?: string
      title?: string
      providerId?: string
      modelId?: string
    }
  ) => Promise<string | null>
  rollbackRound: (
    sessionId: string,
    userMessageId: string,
    scope?: import('@baishou/shared').WorkspaceRollbackScope
  ) => Promise<{ restored: string[]; deleted: string[]; skipped: string[] }>
  previewRollback: (
    sessionId: string,
    userMessageId: string
  ) => Promise<import('@baishou/shared').WorkspaceRollbackPreview>
}

export function useWorkspaceAgentStream(sessionId?: string): UseWorkspaceAgentStreamResult {
  const { t } = useTranslation()
  const stream = useAgentStream(sessionId)
  const [failedTools, setFailedTools] = useState<WorkspaceToolError[]>([])

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined' || !window.electron?.ipcRenderer?.on) return

    const onToolError = (
      _: unknown,
      payload: { sessionId?: string; name?: string; error?: string }
    ) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId || !payload.name) return
      setFailedTools((prev) => [
        ...prev,
        { name: payload.name!, error: payload.error ?? 'Tool execution failed' }
      ])
    }

    const unsubscribe = window.electron.ipcRenderer.on('agent:tool-error', onToolError)
    return () => {
      unsubscribe?.()
    }
  }, [sessionId])

  useEffect(() => {
    if (!stream.isStreaming) return
    setFailedTools([])
  }, [stream.isStreaming])

  // drain / promote 开流时同步 UI 流式态（idle admit 的 started 也会 beginStreaming；此处覆盖排队后的下一轮）
  useEffect(() => {
    if (!sessionId || typeof window === 'undefined' || !window.electron?.ipcRenderer?.on) return

    const onRuntimeEvent = (_: unknown, event: { type?: string; sessionId?: string }) => {
      if (event?.type !== 'session.promoted' || event.sessionId !== sessionId) return
      stream.beginStreaming(sessionId)
      window.dispatchEvent(
        new CustomEvent('baishou:workspace-pending-inputs-changed', {
          detail: { sessionId }
        })
      )
    }

    const unsubscribe = window.electron.ipcRenderer.on(
      'agent:session-runtime-event',
      onRuntimeEvent
    )
    return () => {
      unsubscribe?.()
    }
  }, [sessionId, stream.beginStreaming])

  // admit+drain 路径不再走 runWorkspaceChatStream finally；流结束后补刷新
  const wasStreamingRef = useRef(stream.isStreaming)
  useEffect(() => {
    if (wasStreamingRef.current && !stream.isStreaming && sessionId) {
      window.dispatchEvent(
        new CustomEvent('baishou:workspace-messages-changed', {
          detail: { sessionId }
        })
      )
      window.dispatchEvent(
        new CustomEvent('baishou:workspace-tree-refresh', {
          detail: { sessionId }
        })
      )
      window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
      window.dispatchEvent(
        new CustomEvent('baishou:workspace-pending-inputs-changed', {
          detail: { sessionId }
        })
      )
    }
    wasStreamingRef.current = stream.isStreaming
  }, [sessionId, stream.isStreaming])

  const prepareWorkspaceTurn = useCallback(
    async (
      targetSessionId: string | undefined,
      text: string,
      folderRoot: string,
      options?: {
        assistantId?: string
        title?: string
        displayText?: string
        skillRefs?: Array<{ command: string; content: string }>
      }
    ): Promise<StartWorkspaceChatResult> => {
      let activeSessionId = targetSessionId
      let createdNew = false

      const titleSeed = (options?.displayText || text).trim()

      if (!activeSessionId || activeSessionId === 'new-session') {
        const newId = crypto.randomUUID()
        await window.api.agentWorkspace.createSession({
          id: newId,
          folderRoot,
          assistantId: options?.assistantId,
          title:
            options?.title ||
            titleSeed.substring(0, 10) ||
            t('agent_workspace.default_session_title', '工作区对话')
        })
        activeSessionId = newId
        createdNew = true
        window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
      }

      const saved = await stream.saveUserMessage(activeSessionId, text, undefined, {
        displayText: options?.displayText,
        skillRefs: options?.skillRefs
      })
      if ('error' in saved) {
        throw new Error(saved.error)
      }

      window.dispatchEvent(
        new CustomEvent('baishou:workspace-messages-changed', {
          detail: { sessionId: activeSessionId }
        })
      )

      return {
        sessionId: activeSessionId,
        userMessageId: saved.userMessageId,
        createdNew
      }
    },
    [stream, t]
  )

  const runWorkspaceChatStream = useCallback(
    async (
      activeSessionId: string,
      text: string,
      userMessageId: string,
      options?: {
        providerId?: string
        modelId?: string
        reasoningEffort?: string
        searchMode?: boolean
      }
    ): Promise<void> => {
      setFailedTools([])
      stream.beginStreaming(activeSessionId)
      try {
        await window.api.agentWorkspace.chat({
          sessionId: activeSessionId,
          text,
          userMessageId,
          providerId: options?.providerId,
          modelId: options?.modelId,
          reasoningEffort: options?.reasoningEffort,
          searchMode: options?.searchMode
        })
      } finally {
        finishStreamingSession(activeSessionId)
      }

      window.dispatchEvent(
        new CustomEvent('baishou:workspace-messages-changed', {
          detail: { sessionId: activeSessionId }
        })
      )
      window.dispatchEvent(
        new CustomEvent('baishou:workspace-tree-refresh', {
          detail: { sessionId: activeSessionId }
        })
      )
    },
    [stream]
  )

  const startWorkspaceChat = useCallback(
    async (
      targetSessionId: string | undefined,
      text: string,
      folderRoot: string,
      options?: {
        assistantId?: string
        title?: string
        providerId?: string
        modelId?: string
      }
    ): Promise<string | null> => {
      const prepared = await prepareWorkspaceTurn(targetSessionId, text, folderRoot, options)
      await runWorkspaceChatStream(prepared.sessionId, text, prepared.userMessageId, {
        providerId: options?.providerId,
        modelId: options?.modelId
      })
      return prepared.sessionId
    },
    [prepareWorkspaceTurn, runWorkspaceChatStream]
  )

  const previewRollback = useCallback(
    (sid: string, userMessageId: string) =>
      window.api.agentWorkspace.previewRollback({ sessionId: sid, userMessageId }),
    []
  )

  const rollbackRound = useCallback(
    async (
      sid: string,
      userMessageId: string,
      scope?: import('@baishou/shared').WorkspaceRollbackScope
    ) => {
      const result = await window.api.agentWorkspace.rollbackRound({
        sessionId: sid,
        userMessageId,
        scope
      })
      window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
      window.dispatchEvent(
        new CustomEvent('baishou:workspace-messages-changed', {
          detail: { sessionId: sid }
        })
      )
      window.dispatchEvent(
        new CustomEvent('baishou:workspace-tree-refresh', { detail: { sessionId: sid } })
      )
      return result
    },
    []
  )

  return {
    ...stream,
    failedTools,
    prepareWorkspaceTurn,
    runWorkspaceChatStream,
    startWorkspaceChat,
    rollbackRound,
    previewRollback
  }
}
