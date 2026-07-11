import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import {
  type WebSearchConfig,
  type AIProviderConfig,
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity
} from '@baishou/shared'
import { DEFAULT_WEB_SEARCH_CONFIG } from '@baishou/database'
import { useAgentStore } from '@baishou/store'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useAgentSession } from '../../../hooks/useAgentSession'
import { useAgentSessions } from '../../../hooks/useAgentSessions'
import { useAgentStream } from '../../../hooks/useAgentStream'
import { useAgentModel } from '../../../hooks/useAgentModel'
import { useAgentUserProfile } from '../../../hooks/useAgentUserProfile'
import { useResolvedAssistantAvatar } from '../../../hooks/useResolvedAssistantAvatar'
import { useResolvedUserAvatar } from '../../../hooks/useResolvedUserAvatar'
import { useResolvedChatBackground } from '../../../hooks/useResolvedChatBackground'
import { useAgentNavigationPersistence } from '../../../hooks/useAgentNavigationPersistence'
import { useAgentComposerDraftKey } from '../../../hooks/useAgentComposerDraftKey'
import { resolveActiveToolDisplayName } from '@baishou/ui/native'
import { useAgentAssistants } from './useAgentAssistants'

export function useAgentScreenSession(deps: {
  drawerOpen: boolean
  tr: (key: string, fallback?: string) => string
  webSearchEngine: WebSearchConfig['webSearchEngine']
  setWebSearchEngine: (engine: WebSearchConfig['webSearchEngine']) => void
}) {
  const { drawerOpen, tr, webSearchEngine, setWebSearchEngine } = deps
  const { searchMode, clearSession } = useAgentStore()
  const {
    services,
    dbReady,
    vaultRevision,
    vaultSwitching,
    storageIndexing,
    ecosystemResyncEpoch
  } = useBaishou()
  const currentSessionIdRef = useRef<string | null>(null)
  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>([])
  const userProfile = useAgentUserProfile()

  useEffect(() => {
    if (!dbReady || !services) return
    let cancelled = false
    void services.settingsManager
      .get<AIProviderConfig[]>('ai_providers')
      .then((list) => {
        if (!cancelled) setAiProviders(list ?? [])
      })
      .catch(() => {
        if (!cancelled) setAiProviders([])
      })
    return () => {
      cancelled = true
    }
  }, [dbReady, services, vaultRevision])

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved =
        (await services.settingsManager.get<WebSearchConfig>('web_search_config')) ??
        DEFAULT_WEB_SEARCH_CONFIG
      setWebSearchEngine(saved.webSearchEngine ?? DEFAULT_WEB_SEARCH_CONFIG.webSearchEngine)
    })()
  }, [dbReady, services, setWebSearchEngine])

  const {
    currentAssistant,
    currentProviderId,
    currentModelId,
    displayModelName,
    showAssistantPicker,
    showModelSwitcher,
    setShowAssistantPicker,
    setShowModelSwitcher,
    handleSelectAssistant,
    handleSelectModel,
    setCurrentAssistant,
    syncWithSession,
    hasConfiguredDialogueModel
  } = useAgentModel({ currentSessionIdRef })

  const currentProviderType = useMemo(
    () => aiProviders.find((provider) => provider.id === currentProviderId)?.type,
    [aiProviders, currentProviderId]
  )

  const { sessions, hasMoreSessions, isLoadingMoreSessions, sessionListScrollKey, loadSessions } =
    useAgentSessions(currentAssistant?.id)

  const resolvedCurrentAvatarUri = useResolvedAssistantAvatar(currentAssistant?.avatarPath)
  const resolvedUserAvatarUri = useResolvedUserAvatar(userProfile.avatarPath).uri
  const resolvedChatBackgroundUri = useResolvedChatBackground(userProfile.chatBackgroundPath)
  const chatBackgroundBlur = normalizeChatBackgroundBlur(userProfile.chatBackgroundBlur)
  const chatBackgroundOverlay = normalizeChatBackgroundOverlayOpacity(
    userProfile.chatBackgroundOverlayOpacity
  )
  const hasChatBackground = Boolean(resolvedChatBackgroundUri)

  const {
    currentSessionId,
    setCurrentSessionId,
    hasMore,
    messages,
    refreshSessionMessages,
    bumpReloadEpoch,
    handleLoadMore,
    handleSelectSession,
    handleAssistantSwitched,
    handleCreateSession,
    handleDeleteSession,
    handlePinSession,
    handleRenameSession,
    invalidateCurrentSession
  } = useAgentSession({
    assistantId: currentAssistant?.id,
    providerId: currentProviderId ?? undefined,
    modelId: currentModelId ?? undefined
  })

  currentSessionIdRef.current = currentSessionId

  const composerDraftKey = useAgentComposerDraftKey(currentSessionId)

  useEffect(() => {
    void syncWithSession(currentSessionId)
  }, [currentSessionId, syncWithSession])

  const refreshSessionList = useCallback(() => {
    void loadSessions(true, currentAssistant?.id)
  }, [loadSessions, currentAssistant?.id])

  useEffect(() => {
    if (!drawerOpen || !dbReady || !currentAssistant?.id) return
    const timer = setTimeout(() => {
      void loadSessions(true, currentAssistant.id)
    }, 280)
    return () => clearTimeout(timer)
  }, [drawerOpen, dbReady, currentAssistant?.id, loadSessions])

  const {
    assistants,
    pinnedAssistants,
    pickerAssistants,
    handleSelectAssistantWithTracking,
    loadAssistants
  } = useAgentAssistants({
    dbReady,
    services,
    storageIndexing,
    vaultRevision,
    ecosystemResyncEpoch,
    vaultSwitching,
    currentAssistant,
    setCurrentAssistant,
    handleSelectAssistant,
    handleAssistantSwitched,
    handleSelectSession,
    loadSessions
  })

  useAgentNavigationPersistence({
    dbReady,
    vaultSwitching,
    vaultRevision,
    services,
    assistants,
    currentAssistant,
    currentSessionId,
    handleSelectAssistant,
    handleSelectSession,
    loadSessions,
    clearSession,
    invalidateCurrentSession
  })

  const {
    isStreaming,
    isStreamBridgeActive,
    streamPresentationLinger,
    isRetryActionBusy,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning,
    compressionTriggerMessageId,
    streamError,
    streamingText,
    streamingReasoning,
    tokenUsage,
    activeTool,
    completedTools,
    pendingEmojis,
    handleSend,
    handleStop,
    handleRegenerate,
    handleResend,
    handleEditMessage,
    handleSaveAssistantEdit,
    handleDeleteMessage
  } = useAgentStream(
    currentSessionId,
    currentProviderId,
    currentModelId,
    currentAssistant,
    setCurrentSessionId,
    refreshSessionList,
    searchMode,
    refreshSessionMessages,
    bumpReloadEpoch
  )

  const activeToolDisplayName = useMemo(
    () => resolveActiveToolDisplayName(activeTool, tr, webSearchEngine),
    [activeTool, tr, webSearchEngine]
  )

  return {
    userProfile,
    resolvedCurrentAvatarUri,
    resolvedUserAvatarUri,
    resolvedChatBackgroundUri,
    chatBackgroundBlur,
    chatBackgroundOverlay,
    hasChatBackground,
    currentAssistant,
    currentProviderId,
    currentModelId,
    displayModelName,
    showAssistantPicker,
    showModelSwitcher,
    setShowAssistantPicker,
    setShowModelSwitcher,
    handleSelectModel,
    hasConfiguredDialogueModel,
    currentProviderType,
    sessions,
    hasMoreSessions,
    isLoadingMoreSessions,
    sessionListScrollKey,
    loadSessions,
    currentSessionId,
    hasMore,
    messages,
    handleLoadMore,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handlePinSession,
    handleRenameSession,
    refreshSessionList,
    pinnedAssistants,
    pickerAssistants,
    handleSelectAssistantWithTracking,
    loadAssistants,
    isStreaming,
    isStreamBridgeActive,
    streamPresentationLinger,
    isRetryActionBusy,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning,
    compressionTriggerMessageId,
    streamError,
    streamingText,
    streamingReasoning,
    tokenUsage,
    activeTool,
    completedTools,
    pendingEmojis,
    handleSend,
    handleStop,
    handleRegenerate,
    handleResend,
    handleEditMessage,
    handleSaveAssistantEdit,
    handleDeleteMessage,
    activeToolDisplayName,
    composerDraftKey
  }
}
