import { useEffect, useRef } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import { isConfiguredDialogueModelId, isConfiguredProviderId } from '@baishou/shared'
import { consumeWorkspaceInitMeta } from '../utils/workspace-init-meta.util'

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
    }
  ) => void | Promise<void>
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
    if (!raw?.trim() || consumedRef.current) return
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
    const meta =
      stash?.displayText || stash?.skillRefs?.length
        ? {
            displayText: stash.displayText,
            skillRefs: stash.skillRefs
          }
        : undefined
    void onSendRef.current(raw, undefined, undefined, meta)
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
