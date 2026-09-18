import { useCallback } from 'react'
import { toast } from '@baishou/ui'
import { isConfiguredDialogueModelId, isConfiguredProviderId } from '@baishou/shared'
import { getSessionReasoningEffortOverride } from '../../agent/reasoning-effort-session'
import { notifyWorkspaceSessionsChanged } from '../utils/agent-workspace-screen.util'
import { mergeWorkspaceFileRefsIntoAttachments } from '../utils/workspace-file-ref-send.util'
import {
  hasWorkspaceComposerPayload,
  normalizeWorkspaceSendAttachments
} from '../utils/workspace-message-display.util'
import type { useWorkspaceAgentStream } from './useWorkspaceAgentStream'
import type { useWorkspaceChatMessages } from './useWorkspaceChatMessages'

type Translate = (key: string, fallback: string) => string
type WorkspaceStream = ReturnType<typeof useWorkspaceAgentStream>
type WorkspaceChat = ReturnType<typeof useWorkspaceChatMessages>

export interface UseAgentWorkspaceComposerSendParams {
  t: Translate
  sessionId?: string
  activeFolderRoot: string | null
  currentProviderId: string
  currentModelId: string
  selectedAssistantId?: string
  searchModeEnabled: boolean
  addWorkspaceFromPicker: () => Promise<{ folderRoot: string } | null>
  setFolderRoot: (path: string | null) => void
  setBoundStreamSessionId: (id: string) => void
  navigate: (path: string) => void
  openModelSwitcher: (anchorRect: DOMRect | null) => void
  stream: WorkspaceStream
  chat: WorkspaceChat
}

export function useAgentWorkspaceComposerSend({
  t,
  sessionId,
  activeFolderRoot,
  currentProviderId,
  currentModelId,
  selectedAssistantId,
  searchModeEnabled,
  addWorkspaceFromPicker,
  setFolderRoot,
  setBoundStreamSessionId,
  navigate,
  openModelSwitcher,
  stream,
  chat
}: UseAgentWorkspaceComposerSendParams) {
  return useCallback(
    async (
      text: string,
      incomingAttachments?: unknown[],
      searchMode?: boolean,
      meta?: {
        displayText?: string
        skillRefs?: Array<{ command: string; content: string }>
        fileRefs?: Array<{
          relativePath: string
          selection?: { startLine: number; endLine: number }
          comment?: string
          origin?: 'explorer-drop' | 'mention' | 'selection' | 'comment'
        }>
        delivery?: 'steer' | 'queue'
      }
    ) => {
      const trimmed = text.trim()
      const incoming = normalizeWorkspaceSendAttachments(incomingAttachments)
      if (
        !hasWorkspaceComposerPayload({
          text: trimmed,
          attachments: incoming,
          skillRefs: meta?.skillRefs,
          fileRefs: meta?.fileRefs
        })
      ) {
        return false
      }

      if (
        !isConfiguredProviderId(currentProviderId) ||
        !isConfiguredDialogueModelId(currentModelId)
      ) {
        openModelSwitcher(null)
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return false
      }

      let folder = activeFolderRoot
      if (!folder) {
        const entry = await addWorkspaceFromPicker()
        if (!entry) return false
        folder = entry.folderRoot
        setFolderRoot(folder)
      }

      const displayText = meta?.displayText?.trim() || trimmed
      const skillRefs = meta?.skillRefs?.length ? meta.skillRefs : undefined
      const effectiveSearchMode = searchMode ?? searchModeEnabled
      const delivery = meta?.delivery ?? 'queue'
      const attachments = normalizeWorkspaceSendAttachments(
        mergeWorkspaceFileRefsIntoAttachments({
          attachments: incoming,
          fileRefs: meta?.fileRefs,
          folderRoot: folder
        })
      )

      try {
        const prepared = await stream.prepareWorkspaceTurn(sessionId, trimmed, folder, {
          assistantId: selectedAssistantId,
          displayText,
          skillRefs,
          fileRefs: meta?.fileRefs,
          attachments
        })

        setBoundStreamSessionId(prepared.sessionId)
        chat.setStreamSessionId(prepared.sessionId)
        void chat.refresh(prepared.sessionId)

        if (prepared.createdNew && prepared.sessionId !== sessionId) {
          navigate(`/agent-workspace/${prepared.sessionId}`)
        }

        // 空闲与忙时统一：prepare → admit →（idle 时主进程 drain 开流）
        const admitted = await window.api.agentWorkspace.admit({
          sessionId: prepared.sessionId,
          text: trimmed,
          delivery,
          userMessageId: prepared.userMessageId,
          providerId: currentProviderId,
          modelId: currentModelId,
          reasoningEffort: getSessionReasoningEffortOverride(),
          searchMode: effectiveSearchMode,
          forceStart: !stream.isStreaming
        })
        window.dispatchEvent(
          new CustomEvent('baishou:workspace-pending-inputs-changed', {
            detail: { sessionId: prepared.sessionId }
          })
        )

        if (admitted.queued) {
          toast.showInfo(t('agent_workspace.input_accepted_busy', '已收到，当前轮次结束后继续'))
          return true
        }

        if (admitted.started) {
          stream.beginStreaming(prepared.sessionId)
          notifyWorkspaceSessionsChanged()
        }
        return true
      } catch (error) {
        console.error('[AgentWorkspaceScreen] send failed:', error)
        return false
      }
    },
    [
      activeFolderRoot,
      addWorkspaceFromPicker,
      chat,
      currentModelId,
      currentProviderId,
      navigate,
      openModelSwitcher,
      searchModeEnabled,
      selectedAssistantId,
      sessionId,
      setBoundStreamSessionId,
      setFolderRoot,
      stream,
      t
    ]
  )
}
