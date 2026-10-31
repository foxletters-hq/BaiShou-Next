import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { toast } from '@baishou/ui'
import type { InputBarRef } from '@baishou/ui'
import type { AgentOutletContext } from '../agent-outlet-context'
import {
  useAgentGateInboxStore,
  useSettingsStore,
  useAssistantStore,
  usePromptShortcutStore,
  useUserProfileStore,
  useContextCompressionStore
} from '@baishou/store'
import { useAgentStream, clearStreamBridgeForSession } from './useAgentStream'
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
import { usePersistedSharedMemoryLookback } from '../../../hooks/usePersistedSharedMemoryLookback'
import { usePersistedSearchMode } from './usePersistedSearchMode'
import {
  buildSkillInvocationBody,
  mapSavedAttachmentsForUi,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  isAgentStreamAbortError
} from '@baishou/shared'
import { getSessionReasoningEffortOverride } from '../reasoning-effort-session'
import { isDraftChatSessionId } from '../utils/draft-chat-session.util'
import { applyCompanionContextRecompressResult } from './companion-context-recompress.util'
import { commitCompanionQueueEdit } from './commit-companion-queue-edit'
import { consumeChatInitMeta } from './chat-init-meta.util'
import { usePricingStatus } from './usePricingStatus'

/**
 * 封装 Agent 聊天页面的全部业务状态流转、时序哨兵以及大模型对话控制逻辑的自定义控制器 Hook。
 */
export function useAgentChatFlow() {
  const { t, i18n } = useTranslation()
  const { sessionId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { sessions, loadSessions } = useOutletContext<AgentOutletContext>() || { sessions: [] }

  // ── 1. 各底层 Hook 实例化 ──
  const stream = useAgentStream(sessionId)
  const { currentAssistant } = useAssistantResolver({ sessionId, sessions })
  const model = useModelSelection({ sessionId, currentAssistant })
  const { createSession } = useSessionManager({
    currentAssistantId: currentAssistant?.id ? String(currentAssistant.id) : undefined,
    dialogueProviderId: model.currentProviderId,
    dialogueModelId: model.currentModelId,
    loadSessions
  })
  const chat = useChatMessages({
    sessionId,
    isStreaming: stream.isStreaming,
    streamingText: stream.text,
    streamingReasoning: stream.reasoning
  })
  const tokens = useTokenUsage(sessionId, stream.isStreaming)
  const resolvedLiveCount = useAgentGateInboxStore((state) => {
    if (!sessionId) return 0
    let count = 0
    for (const item of state.resolvedLive ?? []) {
      if (item.request.sessionId === sessionId) count += 1
    }
    return count
  })
  const scroll = useChatScroll({
    sessionId,
    messages: chat.messages,
    streamingText: stream.text,
    streamingReasoning: stream.reasoning,
    isStreaming: stream.isStreaming,
    activeTool: stream.activeTool,
    streamFollowKey: `${stream.completedTools.length}:${resolvedLiveCount}:${stream.pendingAgentGate?.id ?? ''}`
  })
  useStreamError(stream.error, stream.isStreaming)
  const recall = useRecallSearch()

  // 助手消息已落库展示后，清除流式桥接态（避免 StreamingBubble 与 ChatBubble 并存）
  useEffect(() => {
    if (!sessionId || !stream.isBridgeActive) return
    const lastMessage = chat.messages[chat.messages.length - 1]
    if (
      lastMessage?.role === 'assistant' &&
      (Boolean(lastMessage.content?.trim()) ||
        Boolean(lastMessage.reasoning?.trim()) ||
        (lastMessage.toolInvocations?.length ?? 0) > 0 ||
        (lastMessage.attachments?.length ?? 0) > 0)
    ) {
      clearStreamBridgeForSession(sessionId)
    }
  }, [sessionId, stream.isBridgeActive, chat.messages])

  // drain / promote 开流时同步 UI 流式态（排队消耗后的下一轮）
  useEffect(() => {
    if (!sessionId || typeof window === 'undefined' || !window.electron?.ipcRenderer?.on) return
    const beginStreaming = stream.beginStreaming
    const onRuntimeEvent = (
      _: unknown,
      event: { type?: string; sessionId?: string; inputId?: string }
    ) => {
      if (event?.type !== 'session.promoted' || event.sessionId !== sessionId) return
      beginStreaming(sessionId)
      window.dispatchEvent(
        new CustomEvent('baishou:companion-pending-inputs-changed', {
          detail: { sessionId, dropInputId: event.inputId }
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

  // ── 2. Store 状态订阅 ──
  const settings = useSettingsStore()
  const toolConfig = settings.toolManagementConfig || {
    disabledToolIds: [],
    customConfigs: {},
    emojiConfig: { enabled: false, groups: [] }
  }
  const providers = settings?.providers || []
  const { assistants, fetchAssistants } = useAssistantStore()
  const { shortcuts, loadShortcuts, addShortcut, updateShortcut, removeShortcut } =
    usePromptShortcutStore()
  const { profile: userProfile } = useUserProfileStore()
  const { searchMode, setSearchMode, toggleSearchMode } = usePersistedSearchMode()

  // ── 3. 各种 UI 弹窗与控制状态 ──
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)
  const [showAssistantPicker, setShowAssistantPicker] = useState(false)
  const [showRecallSheet, setShowRecallSheet] = useState(false)
  const [showShortcutManager, setShowShortcutManager] = useState(false)
  const [showToolManager, setShowToolManager] = useState(false)
  const { lookbackMonths: recallLookbackMonths, setLookbackMonths: setRecallLookbackMonths } =
    usePersistedSharedMemoryLookback()
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
  const inputBarRef = useRef<InputBarRef>(null)

  // ── 4. TTS 音频朗读 Hook ──
  const tts = useTts(t)

  // ── 5. 计费价格表时间获取与更新 ──
  const { pricingLastUpdated, handleRefreshPricing } = usePricingStatus(t)

  // ── 6. 初始化加载 ──
  useEffect(() => {
    fetchAssistants()
    loadShortcuts()
    const unsubSkills = (
      window.api as { skills?: { onChanged?: (cb: () => void) => () => void } }
    ).skills?.onChanged?.(() => {
      void loadShortcuts()
    })
    const onWindowFocus = () => {
      void loadShortcuts()
    }
    window.addEventListener('focus', onWindowFocus)
    return () => {
      unsubSkills?.()
      window.removeEventListener('focus', onWindowFocus)
    }
  }, [fetchAssistants, loadShortcuts])

  useEffect(() => {
    if (showShortcutManager) {
      void loadShortcuts()
    }
  }, [showShortcutManager, loadShortcuts])

  // ── 7. 搜索模式持久化见 usePersistedSearchMode ──

  // ── 8. 流式结束后的会话刷新与始终朗读（对齐移动端）──
  const prevIsStreamingRef = useRef(stream.isStreaming)
  const awaitingAutoTtsRef = useRef(false)

  useEffect(() => {
    if (!sessionId) {
      awaitingAutoTtsRef.current = false
    }
  }, [sessionId])

  useEffect(() => {
    if (stream.isStreaming && sessionId) {
      awaitingAutoTtsRef.current = true
    }
  }, [stream.isStreaming, sessionId])

  useEffect(() => {
    if (prevIsStreamingRef.current === true && stream.isStreaming === false) {
      if (loadSessions) {
        void loadSessions(true, currentAssistant?.id ? String(currentAssistant.id) : undefined)
      }
    }
    prevIsStreamingRef.current = stream.isStreaming
  }, [stream.isStreaming, sessionId, loadSessions, currentAssistant])

  useEffect(() => {
    if (
      awaitingAutoTtsRef.current &&
      !stream.isStreaming &&
      tts.ttsMode === 'always' &&
      chat.messages.length > 0
    ) {
      const lastMsg = chat.messages[chat.messages.length - 1]
      if (lastMsg?.role === 'assistant' && lastMsg.content?.trim()) {
        awaitingAutoTtsRef.current = false
        void tts.handleTtsReadAloud(lastMsg.content, lastMsg.id)
      }
    }
  }, [chat.messages, stream.isStreaming, tts, sessionId])

  // ── 9. 发送与停止消息 ──
  const handleSend = async (
    text: string,
    attachments?: any[],
    search?: boolean,
    meta?: {
      displayText?: string
      skillRefs?: Array<{ command: string; content: string }>
      delivery?: 'steer' | 'queue'
      /** 正在编辑排队条目时提交正文，不新开一轮 */
      queueEditInputId?: string
    }
  ): Promise<boolean> => {
    let targetSessionId = sessionId
    if (search !== undefined) {
      setSearchMode(search)
    }

    if (
      !isConfiguredProviderId(model.currentProviderId) ||
      !isConfiguredDialogueModelId(model.currentModelId)
    ) {
      toast.showInfo(t('agent.error.no_model', '请先选择一个模型'))
      return false
    }

    let effectiveText = text
    let skillRefs = meta?.skillRefs
    if (skillRefs?.length) {
      try {
        const latestSkills = await (
          window.api as {
            skills?: { list?: () => Promise<Array<{ name: string; content: string }>> }
          }
        )?.skills?.list?.()
        if (Array.isArray(latestSkills) && latestSkills.length > 0) {
          const contentByCommand = new Map(
            latestSkills.map((item) => [
              item.name.trim().replace(/^\/+/, '').toLowerCase(),
              item.content
            ])
          )
          skillRefs = skillRefs.map((ref) => {
            const key = ref.command.trim().replace(/^\/+/, '').toLowerCase()
            const latestContent = contentByCommand.get(key)
            if (typeof latestContent === 'string' && latestContent !== ref.content) {
              const oldBody = buildSkillInvocationBody(ref)
              const nextRef = { ...ref, content: latestContent }
              const newBody = buildSkillInvocationBody(nextRef)
              if (oldBody && effectiveText.includes(oldBody)) {
                effectiveText = effectiveText.replace(oldBody, newBody)
              }
              return nextRef
            }
            return ref
          })
        }
      } catch {
        // 技能列表刷新失败时不阻断发送
      }
    }
    const displayText = meta?.displayText?.trim() || effectiveText
    const needsNewSession = isDraftChatSessionId(sessionId)
    let localQueueId: string | undefined

    try {
      if (meta?.queueEditInputId) {
        return commitCompanionQueueEdit({ inputId: meta.queueEditInputId, text: effectiveText })
      }

      if (needsNewSession) {
        targetSessionId = (await createSession(displayText)) ?? undefined
        if (!targetSessionId) {
          throw new Error(t('agent.error.create_session_failed', '创建会话失败'))
        }
      }

      const busy = stream.isStreaming || stream.isBridgeActive
      const delivery = meta?.delivery ?? (busy ? 'queue' : 'queue')
      localQueueId = busy && targetSessionId ? `local-${crypto.randomUUID()}` : undefined
      if (localQueueId && targetSessionId) {
        window.dispatchEvent(
          new CustomEvent('baishou:companion-pending-inputs-changed', {
            detail: {
              sessionId: targetSessionId,
              optimistic: { id: localQueueId, text: effectiveText }
            }
          })
        )
      }

      const saveResult = await stream.saveUserMessage(targetSessionId, effectiveText, attachments, {
        displayText,
        providerId: model.currentProviderId,
        modelId: model.currentModelId,
        skillRefs
      })
      if ('error' in saveResult) {
        throw new Error(saveResult.error)
      }

      const savedAttachments = mapSavedAttachmentsForUi(saveResult.attachments)

      if (saveResult.userMessageId && !busy) {
        chat.appendSentUserMessage({
          id: saveResult.userMessageId,
          content: displayText,
          attachments: savedAttachments,
          skillRefs
        })
        if (savedAttachments?.length) {
          chat.ensureMessageAttachments(saveResult.userMessageId, savedAttachments)
        }
      }

      const wasNewSession = needsNewSession
      chat.setStreamSessionId(targetSessionId)
      scroll.beginFollowIfAtBottom()

      const refreshPromise = chat.refreshLatestMessages(1, targetSessionId, {
        resetPagination: true
      })

      if (wasNewSession) {
        if (loadSessions) {
          void loadSessions(true, currentAssistant?.id ? String(currentAssistant.id) : undefined)
        }
        const astId = currentAssistant?.id ? String(currentAssistant.id) : ''
        navigate(`/chat/${targetSessionId}${astId ? `?assistantId=${astId}` : ''}`, {
          replace: true
        })
      }

      // 忙时入队、空闲时 admit 开流：禁止再走 agent:chat 直接 claim 打断当前回合
      const admitted = await window.api.admit({
        sessionId: targetSessionId!,
        text: effectiveText,
        delivery,
        userMessageId: saveResult.userMessageId,
        providerId: model.currentProviderId,
        modelId: model.currentModelId,
        reasoningEffort: getSessionReasoningEffortOverride(),
        searchMode: search,
        attachments: saveResult.attachments
      })
      window.dispatchEvent(
        new CustomEvent('baishou:companion-pending-inputs-changed', {
          detail: { sessionId: targetSessionId, dropOptimisticId: localQueueId }
        })
      )

      if (admitted.queued) {
        return true
      }

      if (admitted.started) {
        if (busy) {
          await refreshPromise
          await chat.refreshLatestMessages(2, targetSessionId, { resetPagination: true })
        }
        stream.beginStreaming(targetSessionId!)
      }

      return true
    } catch (e: any) {
      if (localQueueId && targetSessionId) {
        window.dispatchEvent(
          new CustomEvent('baishou:companion-pending-inputs-changed', {
            detail: { sessionId: targetSessionId, dropOptimisticId: localQueueId }
          })
        )
      }
      if (isAgentStreamAbortError(e)) return false
      console.error('[AgentScreen] send failed:', e)
      toast.showError(
        t('agent.error.send_failed', '发送消息失败: {{msg}}', { msg: e?.message || '未知错误' })
      )
      return false
    }
  }

  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend
  const initConsumedRef = useRef<string | null>(null)

  useEffect(() => {
    const raw = searchParams.get('init')
    if (!raw?.trim() || initConsumedRef.current === `${sessionId ?? ''}:${raw}`) return
    if (!isDraftChatSessionId(sessionId)) return
    if (stream.isStreaming) return
    if (
      !isConfiguredProviderId(model.currentProviderId) ||
      !isConfiguredDialogueModelId(model.currentModelId)
    ) {
      return
    }

    initConsumedRef.current = `${sessionId ?? ''}:${raw}`
    const meta = sessionId ? consumeChatInitMeta(sessionId) : null
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('init')
        return next
      },
      { replace: true }
    )
    void handleSendRef.current(raw, undefined, undefined, meta ?? undefined)
  }, [
    searchParams,
    sessionId,
    stream.isStreaming,
    model.currentProviderId,
    model.currentModelId,
    setSearchParams
  ])

  const handleStop = () => {
    stream.stopChat()
    toast.showSuccess(t('agent.stream_cancelled', '取消成功'))
  }

  const dismissContextRecompressError = useCallback(() => {
    if (activeContextSessionId) storeClearRecompressError(activeContextSessionId)
  }, [activeContextSessionId, storeClearRecompressError])

  const runContextRecompress = useCallback(
    async (targetSessionId: string) => {
      if (!targetSessionId) return
      const result = await storeRunRecompress(targetSessionId)
      if (!(result?.ok && result.summaryText)) return
      setContextDialogState((prev) =>
        applyCompanionContextRecompressResult(prev, result.summaryText)
      )
    },
    [storeRunRecompress]
  )

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
    showAssistantPicker,
    setShowAssistantPicker,
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
