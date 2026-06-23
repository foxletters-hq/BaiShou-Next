import { useCallback } from 'react'
import { useAgentStream, type UseAgentStreamResult } from '../../agent/hooks/useAgentStream'

export interface UseWorkspaceAgentStreamResult extends UseAgentStreamResult {
  startWorkspaceChat: (
    sessionId: string | undefined,
    text: string,
    folderRoot: string,
    options?: { assistantId?: string; title?: string }
  ) => Promise<string | null>
  rollbackRound: (sessionId: string, userMessageId: string) => Promise<void>
}

export function useWorkspaceAgentStream(sessionId?: string): UseWorkspaceAgentStreamResult {
  const stream = useAgentStream(sessionId)

  const startWorkspaceChat = useCallback(
    async (
      targetSessionId: string | undefined,
      text: string,
      folderRoot: string,
      options?: { assistantId?: string; title?: string }
    ): Promise<string | null> => {
      let activeSessionId = targetSessionId

      if (!activeSessionId || activeSessionId === 'new-session') {
        const newId = crypto.randomUUID()
        await window.api.agentWorkspace.createSession({
          id: newId,
          folderRoot,
          assistantId: options?.assistantId,
          title: options?.title || text.trim().substring(0, 10) || '工作区对话'
        })
        activeSessionId = newId
        window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
      }

      const saved = await stream.saveUserMessage(activeSessionId, text)
      if ('error' in saved) {
        throw new Error(saved.error)
      }

      stream.beginStreaming(activeSessionId)

      await window.api.agentWorkspace.chat({
        sessionId: activeSessionId,
        text,
        userMessageId: saved.userMessageId
      })

      window.dispatchEvent(
        new CustomEvent('baishou:workspace-messages-changed', {
          detail: { sessionId: activeSessionId }
        })
      )

      return activeSessionId
    },
    [stream]
  )

  const rollbackRound = useCallback(async (sid: string, userMessageId: string) => {
    await window.api.agentWorkspace.rollbackRound({ sessionId: sid, userMessageId })
    window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
    window.dispatchEvent(
      new CustomEvent('baishou:workspace-messages-changed', {
        detail: { sessionId: sid }
      })
    )
    window.dispatchEvent(
      new CustomEvent('baishou:workspace-tree-refresh', { detail: { sessionId: sid } })
    )
  }, [])

  return {
    ...stream,
    startWorkspaceChat,
    rollbackRound
  }
}
