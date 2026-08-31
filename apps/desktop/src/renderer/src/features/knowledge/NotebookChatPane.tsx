import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Cloud, History, Sparkles } from 'lucide-react'
import {
  AssistantPickerSheet,
  ChatBubble,
  InputBar,
  SessionModelMenu,
  ShortcutManagerDialog,
  StreamingBubble,
  getProviderIcon,
  parseRedactedThinking,
  resolveDesktopAssistantAvatarSrc,
  toast,
  useDialog,
  useTheme,
  type InputBarRef,
  type PromptShortcut,
  type SessionData
} from '@baishou/ui'
import { createWebComposerDraftStorage } from '@baishou/ui/shared/composer-draft'
import {
  useAssistantStore,
  usePromptShortcutStore,
  useSettingsStore,
  useUserProfileStore
} from '@baishou/store'
import {
  getReasoningControlForModel,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  isEmbeddingModel,
  isTtsModel,
  normalizeReasoningEffortSetting,
  pickNotebookChatCitations,
  type NotebookChatCitation,
  type NotebookChatMessageRecord,
  type ReasoningEffortSetting
} from '@baishou/shared'
import type { AgentAssistant } from '../agent/components/AgentSidebar'
import { AgentSessionsModal } from '../agent/components/AgentSessionsModal'
import { AgentChatChrome } from '../agent/components/AgentChatChrome'
import chromeStyles from '../agent/components/AgentChatChrome.module.css'
import partnerWelcomeMascot from '../agent/assets/partner-welcome.png'
import agentStyles from '../agent/AgentScreen.module.css'
import {
  buildModelReasoningPreviewMap,
  formatReasoningControlPreview
} from '../agent/format-reasoning-control-preview'
import { useModelSelection } from '../agent/hooks/useModelSelection'
import { usePersistedSearchMode } from '../agent/hooks/usePersistedSearchMode'
import {
  getReasoningEffortForModel,
  setReasoningEffortForModel,
  setSessionReasoningEffortOverride
} from '../agent/reasoning-effort-session'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import { callKnowledgeApi } from './call-knowledge-api'
import { toNotebookChatBubbleMessage } from './notebook-chat-bubble.util'
import {
  applyNotebookAskProgress,
  EMPTY_NOTEBOOK_ASK_STREAM,
  isNotebookAskAbortError,
  subscribeNotebookAskProgress
} from './notebook-ask-progress.util'
import styles from './KnowledgePage.module.css'

type ChatSession = {
  id: string
  notebookId: string
  assistantId: string
  title: string
  pinned?: boolean
  createdAt: number
  updatedAt: number
}

function assistantStorageKey(notebookId: string): string {
  return `baishou.notebook.assistant.${notebookId}`
}

function mapAskError(message: string, t: (key: string, fallback: string) => string): string {
  if (message === 'knowledge-model-mismatch') {
    return t(
      'knowledge.model_mismatch_hard_block',
      '嵌入模型与知识库向量不一致，提问已拦截。请先「重建索引」。'
    )
  }
  if (message === 'embedding-not-configured') {
    return t('knowledge.embedding_required', '请先在系统设置里配置嵌入模型后再提问。')
  }
  if (message === 'dialogue-not-configured' || message.includes('No chat/summary model')) {
    return t('knowledge.dialogue_required', '请先在系统设置里配置对话模型后再提问。')
  }
  return message
}

function splitNotebookAskOutput(answer: string, reasoning?: string) {
  const parsed = parseRedactedThinking(answer, reasoning || '')
  return {
    text: parsed.cleanContent || answer,
    reasoning: parsed.cleanReasoning || undefined
  }
}

export const NotebookChatPane: React.FC<{
  notebookId: string
  sourceCount?: number
  onError: (message: string) => void
}> = ({ notebookId, onError }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dialog = useDialog()
  const { isDark } = useTheme()
  const { assistants, fetchAssistants } = useAssistantStore()
  const providers = useSettingsStore((s) => s.providers)
  const userProfile = useUserProfileStore((s) => s.profile)
  const loadProfile = useUserProfileStore((s) => s.loadProfile)
  const {
    shortcuts,
    loadShortcuts,
    addShortcut,
    updateShortcut,
    removeShortcut
  } = usePromptShortcutStore()
  const inputBarRef = useRef<InputBarRef>(null)
  const [showShortcutManager, setShowShortcutManager] = useState(false)
  const [assistantId, setAssistantId] = useState('')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<NotebookChatMessageRecord[]>([])
  const [asking, setAsking] = useState(false)
  const [stream, setStream] = useState(EMPTY_NOTEBOOK_ASK_STREAM)
  const streamRef = useRef(EMPTY_NOTEBOOK_ASK_STREAM)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)
  const [sessionQuery, setSessionQuery] = useState('')
  const [reasoningPreviewTick, setReasoningPreviewTick] = useState(0)
  const modelTriggerRef = useRef<HTMLButtonElement>(null)
  const [modelMenuAnchor, setModelMenuAnchor] = useState<DOMRect | null>(null)
  const { searchMode, toggleSearchMode } = usePersistedSearchMode()

  const storeAssistant = useMemo(
    () =>
      assistants.find((row) => String(row.id) === assistantId) ||
      assistants.find((row) => row.isDefault) ||
      assistants[0],
    [assistants, assistantId]
  )

  const currentAssistant = useMemo(() => {
    if (!storeAssistant) return undefined
    return {
      id: String(storeAssistant.id),
      name: storeAssistant.name,
      emoji: storeAssistant.emoji || '✨',
      description: storeAssistant.description,
      assistantKind: storeAssistant.assistantKind,
      avatarPath: storeAssistant.avatarPath
    } satisfies AgentAssistant
  }, [storeAssistant])

  const modelAssistant = useMemo(
    () =>
      storeAssistant
        ? {
            id: storeAssistant.id,
            providerId: storeAssistant.providerId,
            modelId: storeAssistant.modelId
          }
        : undefined,
    [storeAssistant]
  )

  const model = useModelSelection({
    sessionId: sessionId ?? undefined,
    currentAssistant: modelAssistant
  })

  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortSetting>(() =>
    getReasoningEffortForModel(model.currentProviderId, model.currentModelId)
  )

  const reasoningProviderType = useMemo(() => {
    const provider = providers.find((row) => row.id === model.currentProviderId)
    return provider?.type || model.currentProviderId || undefined
  }, [model.currentProviderId, providers])

  const reasoningControl = useMemo(
    () => getReasoningControlForModel(model.currentModelId || '', reasoningProviderType),
    [model.currentModelId, reasoningProviderType]
  )

  useEffect(() => {
    const next = getReasoningEffortForModel(model.currentProviderId, model.currentModelId)
    setReasoningEffort(next)
    setSessionReasoningEffortOverride(next)
  }, [model.currentProviderId, model.currentModelId])

  useEffect(() => {
    void fetchAssistants()
    void loadProfile()
    void loadShortcuts()
    void useSettingsStore.getState().ensureConfigKeys(['globalModels', 'providers'])
  }, [fetchAssistants, loadProfile, loadShortcuts])

  useEffect(() => {
    return subscribeNotebookAskProgress((progress) => {
      if (progress.notebookId !== notebookId) return
      setStream((current) => {
        const next = applyNotebookAskProgress(current, progress)
        streamRef.current = next
        return next
      })
    })
  }, [notebookId])

  useEffect(() => {
    if (!asking && messages.length === 0) return
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [asking, messages.length, stream.phase, stream.reasoning, stream.text, stream.tools.length])

  useEffect(() => {
    if (!notebookId) return
    const stored = window.localStorage.getItem(assistantStorageKey(notebookId))
    if (stored) setAssistantId(stored)
  }, [notebookId])

  useEffect(() => {
    if (assistantId || assistants.length === 0) return
    const fallback = assistants.find((row) => row.isDefault) || assistants[0]
    if (fallback) setAssistantId(String(fallback.id))
  }, [assistantId, assistants])

  const loadSessions = useCallback(async () => {
    const rows = await callKnowledgeApi<ChatSession[]>(
      'listChatSessions',
      'knowledge:list-chat-sessions',
      notebookId
    )
    setSessions(rows || [])
    return rows || []
  }, [notebookId])

  const loadMessages = useCallback(
    async (id: string | null) => {
      if (!id) {
        setMessages([])
        return
      }
      const rows = await callKnowledgeApi<NotebookChatMessageRecord[]>(
        'listChatMessages',
        'knowledge:list-chat-messages',
        { notebookId, sessionId: id }
      )
      setMessages(rows || [])
    },
    [notebookId]
  )

  useEffect(() => {
    if (!notebookId) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await loadSessions()
        if (cancelled) return
        const nextId = rows[0]?.id ?? null
        setSessionId(nextId)
        await loadMessages(nextId)
      } catch (error) {
        if (!cancelled) onError(String((error as Error)?.message || error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadMessages, loadSessions, notebookId, onError])

  const switchAssistant = (assistant: AgentAssistant) => {
    setAssistantId(assistant.id)
    window.localStorage.setItem(assistantStorageKey(notebookId), assistant.id)
    if (sessionId) {
      void callKnowledgeApi('updateChatSession', 'knowledge:update-chat-session', {
        notebookId,
        sessionId,
        assistantId: assistant.id
      }).catch((error) => onError(String((error as Error)?.message || error)))
    }
  }

  const startNewSession = () => {
    setSessionId(null)
    setMessages([])
    setStream(EMPTY_NOTEBOOK_ASK_STREAM)
    streamRef.current = EMPTY_NOTEBOOK_ASK_STREAM
  }

  const stopAsk = () => {
    void callKnowledgeApi('cancelAsk', 'knowledge:cancel-ask', notebookId).catch(() => undefined)
  }

  const onAsk = async (text: string, sendSearchMode?: boolean) => {
    const question = text.trim()
    if (!question || !notebookId || asking) return false
    const effectiveSearchMode = sendSearchMode ?? searchMode
    setAsking(true)
    setStream(EMPTY_NOTEBOOK_ASK_STREAM)
    streamRef.current = EMPTY_NOTEBOOK_ASK_STREAM
    onError('')
    let activeSessionId = sessionId
    try {
      const mismatch = await window.api.knowledge.hasModelMismatch?.()
      if (mismatch) throw new Error('knowledge-model-mismatch')
      if (!activeSessionId) {
        const created = await callKnowledgeApi<ChatSession>(
          'createChatSession',
          'knowledge:create-chat-session',
          { notebookId, assistantId }
        )
        activeSessionId = created.id
        setSessionId(created.id)
      }
      await callKnowledgeApi('appendChatMessage', 'knowledge:append-chat-message', {
        notebookId,
        sessionId: activeSessionId,
        role: 'user',
        text: question
      })
      await loadMessages(activeSessionId)
      const result = await callKnowledgeApi<{
        answer: string
        reasoning?: string
        citations?: Array<NotebookChatCitation & { chunkIndex?: number; offset?: number }>
      }>('ask', 'knowledge:ask', {
        notebookId,
        question,
        multiQuery: false,
        assistantId,
        modelId: model.currentModelId,
        providerId: model.currentProviderId,
        reasoningEffort,
        sessionId: activeSessionId,
        searchMode: effectiveSearchMode
      })
      const split = splitNotebookAskOutput(
        result.answer,
        result.reasoning || streamRef.current.reasoning
      )
      await callKnowledgeApi('appendChatMessage', 'knowledge:append-chat-message', {
        notebookId,
        sessionId: activeSessionId,
        role: 'assistant',
        text: split.text,
        reasoning: split.reasoning,
        citations: result.citations || []
      })
      await Promise.all([loadMessages(activeSessionId), loadSessions()])
      return true
    } catch (error) {
      if (isNotebookAskAbortError(error)) {
        const partial = streamRef.current
        if ((partial.text.trim() || partial.reasoning.trim()) && activeSessionId) {
          const split = splitNotebookAskOutput(partial.text, partial.reasoning)
          await callKnowledgeApi('appendChatMessage', 'knowledge:append-chat-message', {
            notebookId,
            sessionId: activeSessionId,
            role: 'assistant',
            text: split.text.trim() || t('knowledge.ask_stopped', '已停止生成。'),
            reasoning: split.reasoning
          }).catch(() => undefined)
          await loadMessages(activeSessionId)
        }
        return false
      }
      onError(mapAskError(String((error as Error)?.message || error), t))
      return false
    } finally {
      setAsking(false)
      setStream(EMPTY_NOTEBOOK_ASK_STREAM)
      streamRef.current = EMPTY_NOTEBOOK_ASK_STREAM
    }
  }

  const noModelSelected = !isConfiguredDialogueModelId(model.currentModelId)
  const composerBlocked =
    !isConfiguredProviderId(model.currentProviderId) ||
    !isConfiguredDialogueModelId(model.currentModelId)
  const isEmptyIdle = messages.length === 0 && !asking
  const providerIconUrl = useMemo(() => {
    const providerId = model.currentProviderId
    if (!providerId || providerId === 'unknown') return undefined
    const providerRecord = providers.find((row) => row.id === providerId)
    return (
      getProviderIcon(providerId, isDark) ||
      (providerRecord?.type ? getProviderIcon(providerRecord.type, isDark) : undefined)
    )
  }, [isDark, model.currentProviderId, providers])
  const effortSuffix = formatReasoningControlPreview({
    modelId: model.currentModelId,
    providerTypeOrId: reasoningProviderType,
    effort: reasoningEffort
  })
  const modelReasoningPreviews = useMemo(
    () => buildModelReasoningPreviewMap(providers),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick refreshes after persist
    [providers, reasoningPreviewTick, showModelSwitcher]
  )
  const composerDraftStorage = useMemo(() => createWebComposerDraftStorage(), [])
  const composerDraftKey = `notebook-chat:${notebookId}:${sessionId || 'draft'}`
  const assistantAvatar = resolveDesktopAssistantAvatarSrc(currentAssistant?.avatarPath)
  const displayAssistantName = currentAssistant?.name || t('agent.partner_label', '伙伴')
  const displayModelName = noModelSelected
    ? t('agent.no_model_selected', '暂未选择模型')
    : model.currentModelId

  const composerFooter = (
    <div className={agentStyles.metaRow}>
      <div className={agentStyles.metaLeading}>
        <button
          type="button"
          className={agentStyles.metaChip}
          onClick={() => setShowPicker(true)}
          aria-haspopup="dialog"
          aria-label={t('agent.select_assistant', '选择伙伴')}
          title={t('agent.select_assistant', '选择伙伴')}
        >
          <span className={agentStyles.assistantAvatar} aria-hidden>
            <img
              key={currentAssistant?.avatarPath ?? currentAssistant?.id ?? 'default'}
              src={assistantAvatar}
              alt=""
            />
          </span>
          <span className={agentStyles.metaChipLabel}>{displayAssistantName}</span>
          <ChevronDown size={12} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={agentStyles.metaIconBtn}
          title={t('knowledge.chat_history', '本笔记本对话')}
          aria-label={t('knowledge.chat_history', '本笔记本对话')}
          onClick={() => setShowSessions(true)}
        >
          <History size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className={agentStyles.metaTrailing}>
        <button
          ref={modelTriggerRef}
          type="button"
          className={`${chromeStyles.modelSwitcherTrigger} ${chromeStyles.modelSwitcherInMeta}`}
          onClick={() => {
            setModelMenuAnchor(modelTriggerRef.current?.getBoundingClientRect() ?? null)
            setShowModelSwitcher(true)
          }}
          aria-label={t('models.switch_model', '切换模型')}
          title={t('models.switch_model', '切换模型')}
        >
          <span className={chromeStyles.modelProviderIcon} aria-hidden>
            {providerIconUrl ? (
              <img src={providerIconUrl} alt="" />
            ) : noModelSelected ? (
              <Sparkles size={15} />
            ) : (
              <Cloud size={15} />
            )}
          </span>
          <span className={chromeStyles.modelName}>{displayModelName}</span>
          {effortSuffix ? <span className={chromeStyles.modelEffort}>{effortSuffix}</span> : null}
          <span className={chromeStyles.chevron}>▼</span>
        </button>
      </div>
    </div>
  )

  const sessionItems: SessionData[] = sessions
    .filter((row) => !sessionQuery.trim() || row.title.includes(sessionQuery.trim()))
    .map((row) => ({
      id: row.id,
      title: row.title || t('knowledge.chat_untitled', '未命名对话'),
      isPinned: Boolean(row.pinned),
      updatedAt: row.updatedAt,
      snippet: ''
    }))

  const inputBar = (
    <InputBar
      ref={inputBarRef}
      isLoading={asking}
      onStop={asking ? stopAsk : undefined}
      onSend={(text, _attachments, sendSearchMode) => onAsk(text, sendSearchMode)}
      composerBlocked={composerBlocked}
      onComposerBlocked={() =>
        toast.showInfo(t('agent.error.no_model', '请先选择一个模型'))
      }
      composerDraftKey={composerDraftKey}
      composerDraftStorage={composerDraftStorage}
      shortcuts={shortcuts as PromptShortcut[]}
      onManageShortcuts={() => setShowShortcutManager(true)}
      placeholder={t('knowledge.ask_placeholder', '例如：这几篇里对齐的主要分歧是什么？')}
      searchMode={searchMode}
      onToggleSearchMode={toggleSearchMode}
      footer={composerFooter}
    />
  )

  return (
    <section
      className={`${styles.detailColumn} ${styles.conversationColumn} ${
        isEmptyIdle ? styles.conversationIdle : ''
      }`}
      aria-label={t('knowledge.conversation_panel', '对话')}
    >
      {!isEmptyIdle ? (
        <AgentChatChrome
          variant="floatingActions"
          currentAssistant={currentAssistant}
          onShowPicker={() => setShowPicker(true)}
          onAssistantSwitched={switchAssistant}
          onNewSession={startNewSession}
        />
      ) : null}
      {!isEmptyIdle ? (
        <div className={agentStyles.messageList}>
          <div className={agentStyles.messageContent}>
            {messages.map((message) => {
              const citations =
                message.role === 'assistant'
                  ? pickNotebookChatCitations(message.text, message.citations)
                  : []
              return (
                <div key={message.id}>
                  <ChatBubble
                    message={toNotebookChatBubbleMessage(message)}
                    userProfile={{
                      nickname: userProfile?.nickname || 'User',
                      avatarPath: userProfile?.avatarPath
                    }}
                    aiProfile={{
                      name: displayAssistantName,
                      avatarPath: currentAssistant?.avatarPath,
                      emoji: currentAssistant?.emoji
                    }}
                  />
                  {citations.length > 0 ? (
                    <div className={styles.citationsUnderBubble}>
                      <div className={styles.citations}>
                        <h3 className={styles.citationsTitle}>{t('knowledge.citations', '引用')}</h3>
                        {citations.map((citation) => (
                          <div
                            key={`${message.id}-${citation.displayIndex}`}
                            className={styles.citation}
                          >
                            <div className={styles.citationTitle}>
                              [{citation.displayIndex}] {citation.title}
                            </div>
                            {citation.excerpt ? (
                              <div className={styles.citationExcerpt}>{citation.excerpt}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
            {asking ? (
              <StreamingBubble
                text={stream.text}
                reasoning={stream.reasoning}
                isReasoning={
                  stream.phase === 'thinking' || Boolean(stream.reasoning && !stream.text)
                }
                isTextStreaming={stream.phase === 'answering'}
                completedTools={stream.tools
                  .filter((row) => row.status !== 'running')
                  .map((row) => ({
                    name: row.displayName || row.name,
                    durationMs: 0
                  }))}
                activeToolName={
                  stream.tools.find((row) => row.status === 'running')?.displayName ||
                  stream.tools.find((row) => row.status === 'running')?.name ||
                  null
                }
                aiProfile={{
                  name: displayAssistantName,
                  avatarPath: currentAssistant?.avatarPath,
                  emoji: currentAssistant?.emoji
                }}
              />
            ) : null}
            <div ref={chatEndRef} />
          </div>
        </div>
      ) : null}
      <div className={isEmptyIdle ? agentStyles.emptyIdle : agentStyles.inputFooter}>
        <div className={isEmptyIdle ? agentStyles.emptyComposer : agentStyles.inputContainer}>
          {isEmptyIdle ? (
            <div className={agentStyles.emptyHero}>
              <div className={agentStyles.emptyMascot} aria-hidden>
                <img
                  src={partnerWelcomeMascot}
                  alt=""
                  className={agentStyles.emptyMascotImg}
                  draggable={false}
                />
              </div>
              <p className={agentStyles.emptyGreeting}>
                {t('knowledge.ask_empty', '开始向这本笔记本提问吧。')}
              </p>
            </div>
          ) : null}
          {inputBar}
        </div>
      </div>

      <ShortcutManagerDialog
        isOpen={showShortcutManager}
        onClose={() => setShowShortcutManager(false)}
        shortcuts={shortcuts as PromptShortcut[]}
        onAdd={addShortcut}
        onUpdate={updateShortcut}
        onDelete={removeShortcut}
        onSelect={(shortcut) => {
          setShowShortcutManager(false)
          inputBarRef.current?.applySkillRef(shortcut)
        }}
      />

      <AssistantPickerSheet
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        currentAssistantId={currentAssistant?.id}
        onRefreshAssistants={fetchAssistants}
        assistants={assistants.map((row) => ({
          ...row,
          id: String(row.id),
          emoji: row.emoji || '✨',
          systemPrompt: row.systemPrompt || '',
          compressSystemPrompt: row.compressSystemPrompt ?? null
        }))}
        pinnedIds={new Set(assistants.filter((row) => row.isPinned).map((row) => String(row.id)))}
        onTogglePin={async (id, isPinned) => {
          if (window.electron) {
            await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, isPinned)
            await fetchAssistants()
          }
        }}
        onSelect={(assistant) => {
          setShowPicker(false)
          switchAssistant({
            id: String(assistant.id),
            name: assistant.name,
            emoji: assistant.emoji || '✨',
            avatarPath: assistant.avatarPath
          })
        }}
      />

      {showModelSwitcher ? (
        <SessionModelMenu
          onClose={() => setShowModelSwitcher(false)}
          providers={providers
            .map((row) => {
              const modelList =
                row.enabledModels && row.enabledModels.length > 0
                  ? row.enabledModels
                  : row.models || []
              const filteredModels = modelList.filter((item) => !isEmbeddingModel(item) && !isTtsModel(item))
              return {
                id: row.id,
                name: row.name || row.id,
                type: row.type || 'custom',
                models: row.models || [],
                enabledModels: filteredModels
              }
            })
            .filter((row) => row.enabledModels.length > 0)}
          currentProviderId={model.currentProviderId}
          currentModelId={model.currentModelId}
          onSelect={(pid, mid) => {
            void model.selectDialogueModel(pid, mid)
          }}
          onManageProviders={() => navigate(`${SETTINGS_HUB_PREFIX}/ai-services`)}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={(value) => {
            const normalized = normalizeReasoningEffortSetting(value)
            setReasoningEffort(normalized)
            setSessionReasoningEffortOverride(normalized)
            if (model.currentProviderId && model.currentModelId) {
              setReasoningEffortForModel(model.currentProviderId, model.currentModelId, normalized)
              setReasoningPreviewTick((n) => n + 1)
            }
          }}
          reasoningControl={reasoningControl}
          modelReasoningPreviews={modelReasoningPreviews}
          anchorRect={modelMenuAnchor}
        />
      ) : null}

      <AgentSessionsModal
        isOpen={showSessions}
        assistantName={t('knowledge.notebook_chats', '本笔记本')}
        sessions={sessionItems}
        selectedSessionId={sessionId ?? undefined}
        searchQuery={sessionQuery}
        onClose={() => setShowSessions(false)}
        onSearchQueryChanged={setSessionQuery}
        onSessionSelected={(id) => {
          setSessionId(id)
          void loadMessages(id)
        }}
        onPinSession={(id) => {
          const row = sessions.find((item) => item.id === id)
          void callKnowledgeApi('updateChatSession', 'knowledge:update-chat-session', {
            notebookId,
            sessionId: id,
            pinned: !row?.pinned
          })
            .then(() => loadSessions())
            .catch((error) => onError(String((error as Error)?.message || error)))
        }}
        onDeleteSession={(id) => {
          void callKnowledgeApi('updateChatSession', 'knowledge:update-chat-session', {
            notebookId,
            sessionId: id,
            deletedAt: Date.now()
          })
            .then(async () => {
              const rows = await loadSessions()
              const nextId = sessionId === id ? (rows[0]?.id ?? null) : sessionId
              setSessionId(nextId)
              await loadMessages(nextId)
            })
            .catch((error) => onError(String((error as Error)?.message || error)))
        }}
        onRenameSession={(id) => {
          const row = sessions.find((item) => item.id === id)
          void dialog
            .prompt(
              t('knowledge.chat_rename', '重命名对话'),
              row?.title || '',
              t('knowledge.chat_rename', '重命名对话')
            )
            .then((next) => {
              if (next == null) return
              return callKnowledgeApi('updateChatSession', 'knowledge:update-chat-session', {
                notebookId,
                sessionId: id,
                title: String(next)
              }).then(() => loadSessions())
            })
            .catch((error) => onError(String((error as Error)?.message || error)))
        }}
        onBatchDelete={(ids) => {
          void Promise.all(
            ids.map((id) =>
              callKnowledgeApi('updateChatSession', 'knowledge:update-chat-session', {
                notebookId,
                sessionId: id,
                deletedAt: Date.now()
              })
            )
          )
            .then(async () => {
              const rows = await loadSessions()
              const nextId = sessionId && ids.includes(sessionId) ? (rows[0]?.id ?? null) : sessionId
              setSessionId(nextId)
              await loadMessages(nextId)
            })
            .catch((error) => onError(String((error as Error)?.message || error)))
        }}
      />
    </section>
  )
}
