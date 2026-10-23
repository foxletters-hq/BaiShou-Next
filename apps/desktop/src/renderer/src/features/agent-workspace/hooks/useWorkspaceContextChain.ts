import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast, type CallChainFlatEntry, type CallChainPanelMeta } from '@baishou/ui'
import type { MockChatMessage } from '@baishou/shared'
import type { WorkspaceChatMessage } from './useWorkspaceChatMessages'
import {
  mapWorkspaceContextAtMessage,
  toWorkspaceContextBubbleMessage,
  type WorkspaceContextAtMessageResult
} from '../utils/workspace-context-at-message.util'

export type WorkspaceContextDialogState = {
  isOpen: boolean
  sessionId?: string
  message?: MockChatMessage
  flatEntries?: CallChainFlatEntry[]
  meta?: CallChainPanelMeta
  compressedContent?: string
  systemPrompt?: string
}

export function useWorkspaceContextChain(options: {
  sessionId?: string
  searchModeEnabled: boolean
}) {
  const { sessionId, searchModeEnabled } = options
  const { t } = useTranslation()
  const [state, setState] = useState<WorkspaceContextDialogState>({ isOpen: false })

  const showContext = useCallback(
    async (source: WorkspaceChatMessage) => {
      if (!sessionId || typeof window === 'undefined' || !window.electron) return
      try {
        const result = (await window.electron.ipcRenderer.invoke(
          'agent:get-context-at-message',
          sessionId,
          source.id,
          searchModeEnabled
        )) as WorkspaceContextAtMessageResult
        const fallbackMessage = toWorkspaceContextBubbleMessage(source, sessionId)
        const mapped = mapWorkspaceContextAtMessage(result, {
          fallbackMessage,
          sessionId,
          sourceMessageId: source.id,
          systemPromptLabel: t('chat.system_prompt', '系统提示词'),
          timestamp: fallbackMessage.timestamp
        })
        if (!mapped) return
        setState({
          isOpen: true,
          sessionId,
          message: mapped.message,
          flatEntries: mapped.flatEntries,
          meta: mapped.meta,
          compressedContent: mapped.compressedContent,
          systemPrompt: mapped.systemPrompt
        })
      } catch (error) {
        console.error('[useWorkspaceContextChain] load context failed:', error)
        toast.showError(t('workspace_context.load_failed', '无法加载这条消息的上下文'))
      }
    },
    [searchModeEnabled, sessionId, t]
  )

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  return { state, showContext, close }
}
