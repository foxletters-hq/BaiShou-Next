import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { toast } from '@baishou/ui'
import type { InputBarRef } from '@baishou/ui'
import {
  useSettingsStore,
  useAssistantStore,
  usePromptShortcutStore,
  useUserProfileStore,
  useAgentStore,
  useContextCompressionStore
} from '@baishou/store'
import { useAgentStream } from './useAgentStream'
import { useChatMessages } from './useChatMessages'
import { useSessionManager } from './useSessionManager'
import { useModelSelection } from './useModelSelection'
import { useTokenUsage } from './useTokenUsage'
import { useChatScroll } from './useChatScroll'
import { useStreamError } from './useStreamError'
import { useRecallSearch } from './useRecallSearch'
import { useAssistantResolver } from './useAssistantResolver'
import { useTranslation } from 'react-i18next'
import { useTts } from './useTts'
import { mapSavedAttachmentsForUi } from '@baishou/shared'

/**
 * 封装 Agent 聊天页面的全部业务状态流转、时序哨兵以及大模型对话控制逻辑的自定义控制器 Hook。
 */
export function useAgentChatFlow() {
  const { t, i18n } = useTranslation()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { sessions, loadSessions } = useOutletContext<{
    sessions: any[]
    loadSessions?: (reset: boolean, assistantId?: string) => void
  }>() || { sessions: [] }

  // ── 1. 各底层 Hook 实例化 ──
  const stream = useAgentStream(sessionId)
  const { currentAssistant } = useAssistantResolver({ sessionId, sessions })
  const { createSession } = useSessionManager({
    currentAssistantId: currentAssistant?.id ? String(currentAssistant.id) : undefined,
    loadSessions
  })
  const model = useModelSelection({ sessionId, currentAssistant })
  const chat = useChatMessages({
    sessionId,
    isStreaming: stream.isStreaming,
    streamingText: stream.text,
    streamingReasoning: stream.reasoning
  })
  const tokens = useTokenUsage(sessionId, stream.isStreaming)
  const scroll = useChatScroll({
    sessionId,
    messages: chat.messages,
    streamingText: stream.text,
    streamingReasoning: stream.reasoning,
    isStreaming: stream.isStreaming,
    activeTool: stream.activeTool
  })
  useStreamError(stream.error, stream.isStreaming)
  const recall = useRecallSearch()

  // ── 2. Store 状态订阅 ──
  const settings = useSettingsStore()
  const toolConfig = settings.toolManagementConfig || { disabledToolIds: [], customConfigs: {} }
  const providers = settings?.providers || []
  const { assistants, fetchAssistants } = useAssistantStore()
  const { shortcuts, loadShortcuts, addShortcut, updateShortcut, removeShortcut } =
    usePromptShortcutStore()
  const { profile: userProfile } = useUserProfileStore()
  const searchMode = useAgentStore((s) => s.searchMode)
  const setSearchMode = useAgentStore((s) => s.setSearchMode)
  const toggleSearchMode = useAgentStore((s) => s.toggleSearchMode)

  // ── 3. 各种 UI 弹窗与控制状态 ──
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)
  const [showCostDialog, setShowCostDialog] = useState(false)
  const [showAssistantPicker, setShowAssistantPicker] = useState(false)
  const [showShortcutSheet, setShowShortcutSheet] = useState(false)
  const [showRecallSheet, setShowRecallSheet] = useState(false)
  const [showShortcutManager, setShowShortcutManager] = useState(false)
  const [showToolManager, setShowToolManager] = useState(false)
  const [recallLookbackMonths, setRecallLookbackMonths] = useState(1)
  const [contextDialogState, setContextDialogState] = useState<{
    isOpen: boolean
    sessionId?: string
    sourceMessageId?: string
    message?: any
    flatEntries?: any[]
    meta?: any
    compressedContent?: string
    systemPrompt?: string
  }>({ isOpen: false })
  const activeContextSessionId = contextDialogState.sessionId ?? sessionId
  const contextRecompressJob = useContextCompressionStore((s) =>
    activeContextSessionId ? s.jobs[activeContextSessionId] : undefined
  )
  const storeRunRecompress = useContextCompressionStore((s) => s.runRecompress)
  const storeClearRecompressError = useContextCompressionStore((s) => s.clearError)
  const [pricingLastUpdated, setPricingLastUpdated] = useState<Date | null>(null)
  const pricingBootWarnShownRef = useRef(false)
  const inputBarRef = useRef<InputBarRef>(null)

  // ── 4. TTS 音频朗读 Hook ──
  const tts = useTts(t)

  // ── 5. 计费价格表时间获取与更新 ──
  const fetchPricingLastUpdated = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      try {
        const status = await window.electron.ipcRenderer.invoke('pricing:get-status')
        if (status?.lastUpdated) {
          setPricingLastUpdated(new Date(status.lastUpdated))
        }

        const pricingUnavailable =
          status?.loadFailed || status?.hasPrices === false || !status?.lastUpdated
        if (pricingUnavailable && !pricingBootWarnShownRef.current) {
          pricingBootWarnShownRef.current = true
          toast.showWarning(
            t(
              'agent.chat.pricing_boot_load_failed',
              '未能拉取 models.dev 价格表，计费估算可能不准确，请检查网络后在计费面板中刷新'
            )
          )
        }
      } catch (e) {
        console.error('Failed to get pricing status:', e)
        if (!pricingBootWarnShownRef.current) {
          pricingBootWarnShownRef.current = true
          toast.showWarning(
            t(
              'agent.chat.pricing_boot_load_failed',
              '未能拉取 models.dev 价格表，计费估算可能不准确，请检查网络后在计费面板中刷新'
            )
          )
        }
      }
    }
  }, [t])

  const handleRefreshPricing = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      try {
        const result = await window.electron.ipcRenderer.invoke('pricing:refresh')
        if (result.success && result.lastUpdated) {
          setPricingLastUpdated(new Date(result.lastUpdated))
          toast.showSuccess(t('agent.chat.pricing_refreshed', '价格表已更新'))
        } else if (!result.success || result.loadFailed || !result.hasPrices) {
          toast.showError(result.error || t('agent.chat.pricing_refresh_failed', '价格表刷新失败'))
        }
        return result
      } catch (e) {
        const errMsg =
          e instanceof Error ? e.message : t('agent.chat.pricing_refresh_failed', '价格表刷新失败')
        console.error('Failed to refresh pricing:', e)
        toast.showError(errMsg)
        return { success: false, error: errMsg }
      }
    }
    return { success: false, error: 'No electron context' }
  }, [t])

  useEffect(() => {
    fetchPricingLastUpdated()
  }, [fetchPricingLastUpdated])

  // ── 6. 初始化加载 ──
  useEffect(() => {
    fetchAssistants()
    loadShortcuts()
  }, [fetchAssistants, loadShortcuts])

  // ── 7. 搜索模式持久化 ──
  const searchModeLoadedRef = useRef(false)
  useEffect(() => {
    const api = (window as any).api
    if (api?.settings?.getSearchModeEnabled) {
      api.settings
        .getSearchModeEnabled()
        .then((enabled: boolean) => {
          setSearchMode(!!enabled)
          searchModeLoadedRef.current = true
        })
        .catch(() => {
          searchModeLoadedRef.current = true
        })
    } else {
      searchModeLoadedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!searchModeLoadedRef.current) return
    const api = (window as any).api
    if (api?.settings?.setSearchModeEnabled) {
      api.settings.setSearchModeEnabled(searchMode)
    }
  }, [searchMode])

  // ── 8. 流式时序哨兵与朗读 ──
  const prevIsStreamingRef = useRef(stream.isStreaming)
  const waitingForAutoPlayRef = useRef<string | null>(null)

  useEffect(() => {
    if (!stream.isStreaming) {
      waitingForAutoPlayRef.current = null
    }
  }, [sessionId, stream.isStreaming])

  useEffect(() => {
    if (prevIsStreamingRef.current === true && stream.isStreaming === false) {
      if (loadSessions) {
        loadSessions(true, currentAssistant?.id ? String(currentAssistant.id) : undefined)
      }
    }
    prevIsStreamingRef.current = stream.isStreaming
  }, [stream.isStreaming, sessionId, loadSessions, currentAssistant])

  useEffect(() => {
    if (stream.isStreaming && sessionId) {
      waitingForAutoPlayRef.current = sessionId
    }
  }, [stream.isStreaming, sessionId])

  useEffect(() => {
    if (
      waitingForAutoPlayRef.current === sessionId &&
      !stream.isStreaming &&
      chat.messages.length > 0
    ) {
      const lastMsg = chat.messages[chat.messages.length - 1]
      if (lastMsg.role === 'assistant' && lastMsg.content) {
        waitingForAutoPlayRef.current = null
        if (tts.ttsMode === 'always') {
          tts.handleTtsReadAloud(lastMsg.content, lastMsg.id)
        }
      }
    }
  }, [chat.messages, stream.isStreaming, tts.ttsMode, tts.handleTtsReadAloud, sessionId])

  // ── 9. 发送与停止消息 ──
  const handleSend = async (text: string, attachments?: any[], search?: boolean) => {
    let targetSessionId = sessionId
    setSearchMode(search ?? false)

    try {
      if (!targetSessionId) {
        targetSessionId = (await createSession(text)) ?? undefined
        if (!targetSessionId) {
          throw new Error(t('agent.error.create_session_failed', '创建会话失败'))
        }
      }

      const saveResult = await stream.saveUserMessage(targetSessionId, text, attachments)
      if ('error' in saveResult) {
        throw new Error(saveResult.error)
      }

      await chat.refreshMessages(1, targetSessionId)

      const savedAttachments = mapSavedAttachmentsForUi(saveResult.attachments)
      if (saveResult.userMessageId && savedAttachments?.length) {
        chat.ensureMessageAttachments(saveResult.userMessageId, savedAttachments)
      }

      if (!sessionId) {
        if (loadSessions) {
          await loadSessions(true, currentAssistant?.id ? String(currentAssistant.id) : undefined)
        }
        const astId = currentAssistant?.id ? String(currentAssistant.id) : ''
        navigate(`/chat/${targetSessionId}${astId ? `?assistantId=${astId}` : ''}`, {
          replace: true
        })
      }

      chat.setStreamSessionId(targetSessionId)
      scroll.beginFollowIfAtBottom()
      await stream.startChat(
        targetSessionId,
        text,
        model.currentProviderId,
        model.currentModelId,
        saveResult.attachments,
        search,
        saveResult.userMessageId
      )
    } catch (e: any) {
      console.error('[AgentScreen] send failed:', e)
      toast.showError(
        t('agent.error.send_failed', '发送消息失败: {{msg}}', { msg: e?.message || '未知错误' })
      )
    }
  }

  const handleStop = () => {
    stream.stopChat()
  }

  const runContextRecompress = useCallback(
    async (targetSessionId: string) => {
      if (!targetSessionId) return
      const result = await storeRunRecompress(targetSessionId)
      if (result?.ok && result.summaryText) {
        // 面板仍挂载时即时刷新摘要；若已切走（组件卸载）此更新为 no-op，
        // 重新进入会话重新拉取调用链时会从数据库读到最新快照。
        setContextDialogState((prev) => ({
          ...prev,
          compressedContent: result.summaryText,
          flatEntries: prev.flatEntries?.map((entry: { kind?: string; summaryText?: string }) =>
            entry.kind === 'compression-summary'
              ? { ...entry, summaryText: result.summaryText }
              : entry
          )
        }))
      }
    },
    [storeRunRecompress]
  )

  const dismissContextRecompressError = useCallback(() => {
    if (activeContextSessionId) storeClearRecompressError(activeContextSessionId)
  }, [activeContextSessionId, storeClearRecompressError])

  return {
    t,
    i18n,
    sessionId,
    sessions,
    loadSessions,
    chat,
    stream,
    scroll,
    model,
    tokens,
    recall,
    tts,
    searchMode,
    toggleSearchMode,
    assistants,
    fetchAssistants,
    shortcuts,
    addShortcut,
    updateShortcut,
    removeShortcut,
    // UI 控制状态
    showModelSwitcher,
    setShowModelSwitcher,
    showCostDialog,
    setShowCostDialog,
    showAssistantPicker,
    setShowAssistantPicker,
    showShortcutSheet,
    setShowShortcutSheet,
    showRecallSheet,
    setShowRecallSheet,
    showShortcutManager,
    setShowShortcutManager,
    showToolManager,
    setShowToolManager,
    recallLookbackMonths,
    setRecallLookbackMonths,
    contextDialogState,
    setContextDialogState,
    contextRecompressJob,
    runContextRecompress,
    dismissContextRecompressError,
    pricingLastUpdated,
    handleRefreshPricing,
    currentAssistant,
    userProfile,
    toolConfig,
    providers,
    inputBarRef,
    handleSend,
    handleStop
  }
}
