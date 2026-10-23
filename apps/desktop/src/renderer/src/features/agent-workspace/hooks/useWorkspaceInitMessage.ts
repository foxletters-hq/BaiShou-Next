import { useEffect, useRef } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import { isConfiguredDialogueModelId, isConfiguredProviderId } from '@baishou/shared'
import { consumeWorkspaceInitMeta } from '../utils/workspace-init-meta.util'
import { hasWorkspaceComposerPayload } from '../utils/workspace-message-display.util'

/**
 * 消费首页带来的 ?init= 首条消息：只发送一次，并在模型未就绪时等待。
 */
export function useWorkspaceInitMessage(params: {
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  sessionId?: string
  activeFolderRoot: string | null | undefined
  isStreaming: boolean
  loadingWorkspaces: boolean
  currentProviderId: string | null | undefined
  currentModelId: string | null | undefined
  setShowModelSwitcher: (open: boolean) => void
  onSend: (
    text: string,
    attachments?: unknown[],
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
    }
  ) => boolean | void | Promise<boolean | void>
}): void {
  const {
    searchParams,
    setSearchParams,
    sessionId,
    activeFolderRoot,
    isStreaming,
    loadingWorkspaces,
    currentProviderId,
    currentModelId,
    setShowModelSwitcher,
    onSend
  } = params

  const onSendRef = useRef(onSend)
  onSendRef.current = onSend
  const consumedRef = useRef(false)

  useEffect(() => {
    const raw = searchParams.get('init')
    if (raw === null || consumedRef.current) return
    if (!sessionId || !activeFolderRoot || isStreaming || loadingWorkspaces) return

    if (
      !isConfiguredProviderId(currentProviderId) ||
      !isConfiguredDialogueModelId(currentModelId)
    ) {
      setShowModelSwitcher(true)
      return
    }

    consumedRef.current = true
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('init')
        return next
      },
      { replace: true }
    )

    const stash = consumeWorkspaceInitMeta(sessionId)
    const sendText = (stash?.text ?? raw).trim()
    const attachments = stash?.attachments
    if (
      !hasWorkspaceComposerPayload({
        text: sendText,
        attachments,
        skillRefs: stash?.skillRefs,
        fileRefs: stash?.fileRefs
      })
    ) {
      return
    }
    const meta =
      stash?.displayText || stash?.skillRefs?.length || stash?.fileRefs?.length
        ? {
            displayText: stash.displayText,
            skillRefs: stash.skillRefs,
            fileRefs: stash.fileRefs
          }
        : undefined
    void onSendRef.current(sendText, attachments, undefined, meta)
  }, [
    activeFolderRoot,
    currentModelId,
    currentProviderId,
    isStreaming,
    loadingWorkspaces,
    searchParams,
    sessionId,
    setSearchParams,
    setShowModelSwitcher
  ])
}
