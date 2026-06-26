import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentPart } from '@baishou/shared'

export interface WorkspaceChatMessage {
  id: string
  role: string
  content?: string
  reasoning?: string
  parts?: AgentPart[]
  createdAt?: Date | string
}

export interface PendingWorkspaceAssistantMsg {
  id: string
  content: string
  reasoning?: string
}

async function fetchWorkspaceMessages(sessionId: string): Promise<WorkspaceChatMessage[]> {
  const rows = (await window.electron.ipcRenderer.invoke(
    'agent:get-messages',
    sessionId,
    999,
    0,
    true
  )) as WorkspaceChatMessage[] | null
  return Array.isArray(rows) ? rows : []
}

export function useWorkspaceChatMessages(params: {
  sessionId?: string
  isStreaming: boolean
  streamingText: string
  streamingReasoning: string
}) {
  const { sessionId, isStreaming, streamingText, streamingReasoning } = params
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([])
  const [pendingAssistantMsg, setPendingAssistantMsg] =
    useState<PendingWorkspaceAssistantMsg | null>(null)
  const streamSessionIdRef = useRef<string | null>(null)
  const prevStreamingRef = useRef(isStreaming)

  const refresh = useCallback(async (overrideSessionId?: string) => {
    const sid = overrideSessionId ?? sessionId
    if (!sid || sid === 'new-session') {
      setMessages([])
      return
    }
    const rows = await fetchWorkspaceMessages(sid)
    setMessages(rows)
  }, [sessionId])

  const setStreamSessionId = useCallback((sid: string | null) => {
    streamSessionIdRef.current = sid
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail
      if (!detail?.sessionId || detail.sessionId !== sessionId) return
      void refresh()
    }
    window.addEventListener('baishou:workspace-messages-changed', onChanged)
    window.addEventListener('baishou:assistant-message-usage', onChanged)
    return () => {
      window.removeEventListener('baishou:workspace-messages-changed', onChanged)
      window.removeEventListener('baishou:assistant-message-usage', onChanged)
    }
  }, [refresh, sessionId])

  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && sessionId) {
      if (
        streamSessionIdRef.current === sessionId &&
        (streamingText || streamingReasoning)
      ) {
        setPendingAssistantMsg({
          id: `pending-${Date.now()}`,
          content: streamingText,
          reasoning: streamingReasoning || undefined
        })
      }

      const sync = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        await refresh()
        setPendingAssistantMsg(null)
      }
      void sync()
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, sessionId, streamingReasoning, streamingText, refresh])

  return {
    messages,
    pendingAssistantMsg,
    refresh,
    setStreamSessionId
  }
}
