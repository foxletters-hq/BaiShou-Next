import { useCallback, useEffect, useState } from 'react'
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
    }
  ) => Promise<StartWorkspaceChatResult>
  runWorkspaceChatStream: (
    sessionId: string,
    text: string,
    userMessageId: string,
    options?: {
      providerId?: string
      modelId?: string
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
    userMessageId: string
  ) => Promise<{ restored: string[]; deleted: string[]; skipped: string[] }>
}

export function useWorkspaceAgentStream(sessionId?: string): UseWorkspaceAgentStreamResult {
  const stream = useAgentStream(sessionId)
  const [failedTools, setFailedTools] = useState<WorkspaceToolError[]>([])

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined' || !window.electron?.ipcRenderer?.on) return

    const onToolError = (_: unknown, payload: { sessionId?: string; name?: string; error?: string }) => {
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

  const prepareWorkspaceTurn = useCallback(
    async (
      targetSessionId: string | undefined,
      text: string,
      folderRoot: string,
      options?: {
        assistantId?: string
        title?: string
      }
    ): Promise<StartWorkspaceChatResult> => {
      let activeSessionId = targetSessionId
      let createdNew = false

      if (!activeSessionId || activeSessionId === 'new-session') {
        const newId = crypto.randomUUID()
        await window.api.agentWorkspace.createSession({
          id: newId,
          folderRoot,
          assistantId: options?.assistantId,
          title: options?.title || text.trim().substring(0, 10) || '工作区对话'
        })
        activeSessionId = newId
        createdNew = true
        window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
      }

      const saved = await stream.saveUserMessage(activeSessionId, text)
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
    [stream]
  )

  const runWorkspaceChatStream = useCallback(
    async (
      activeSessionId: string,
      text: string,
      userMessageId: string,
      options?: {
        providerId?: string
        modelId?: string
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
          modelId: options?.modelId
        })
      } finally {
        finishStreamingSession(activeSessionId)
      }

      window.dispatchEvent(
        new CustomEvent('baishou:workspace-messages-changed', {
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

  const rollbackRound = useCallback(async (sid: string, userMessageId: string) => {
    const result = await window.api.agentWorkspace.rollbackRound({ sessionId: sid, userMessageId })
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
  }, [])

  return {
    ...stream,
    failedTools,
    prepareWorkspaceTurn,
    runWorkspaceChatStream,
    startWorkspaceChat,
    rollbackRound
  }
}
