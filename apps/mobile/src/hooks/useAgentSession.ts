import { useState, useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useAgentStore, type AgentMessagePart } from '@baishou/store'
import { useBaishou } from '../providers/BaishouProvider'
import { buildInsertSessionInput } from '../utils/session-input.util'
import { mapSessionMessageFromDb } from '../utils/map-session-message.util'
import {
  CHAT_MESSAGE_FETCH_LIMIT,
  CHAT_ROUNDS_PER_PAGE,
  applyCacheToWindow,
  computeInitialRoundWindowStart,
  expandRoundWindowStart,
  groupMessagesIntoRounds,
  dedupeMessagesById
} from '../utils/chat-round-pagination'
import { messageHasUsageStats } from '../utils/message-usage.util'

interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  timestamp: Date
  toolInvocations?: any[]
  attachments?: any[]
  parts?: AgentMessagePart[]
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
  costMicros?: number
}

export interface UseAgentSessionOptions {
  assistantId?: string
  providerId?: string
  modelId?: string
}

function resetPaginationRefs(refs: {
  messageCacheRef: MutableRefObject<SessionMessage[]>
  roundWindowStartRef: MutableRefObject<number>
  loadedFromEndRef: MutableRefObject<number>
  fetchHasMoreRef: MutableRefObject<boolean>
}) {
  refs.messageCacheRef.current = []
  refs.roundWindowStartRef.current = 0
  refs.loadedFromEndRef.current = 0
  refs.fetchHasMoreRef.current = false
}

export function useAgentSession(_options: UseAgentSessionOptions = {}) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { messages, setMessages, clearSession, currentSessionId, setCurrentSessionId } =
    useAgentStore()
  const { services, dbReady, vaultSwitching, vaultRevision, storageIndexing, ecosystemResyncEpoch } =
    useBaishou()
  const storageRootRef = useRef<string | null>(null)

  const [hasMore, setHasMore] = useState(false)

  const messageCacheRef = useRef<SessionMessage[]>([])
  const roundWindowStartRef = useRef(0)
  const loadedFromEndRef = useRef(0)
  const fetchHasMoreRef = useRef(false)
  const loadMoreLockRef = useRef(false)
  const paginationRefs = {
    messageCacheRef,
    roundWindowStartRef,
    loadedFromEndRef,
    fetchHasMoreRef
  }
  const lastVaultRevisionRef = useRef(vaultRevision)
  const lastEcosystemResyncEpochRef = useRef(ecosystemResyncEpoch)

  const resetSessionState = useCallback(() => {
    setCurrentSessionId(null)
    setHasMore(false)
    resetPaginationRefs(paginationRefs)
    clearSession()
  }, [clearSession])

  useEffect(() => {
    storageRootRef.current = null
    if (!services) return
    let cancelled = false
    void services.pathService.getRootDirectory().then((root) => {
      if (!cancelled) storageRootRef.current = root
    })
    return () => {
      cancelled = true
    }
  }, [services, vaultRevision])

  const resolveStorageRoot = useCallback(async (): Promise<string | undefined> => {
    if (storageRootRef.current) return storageRootRef.current
    if (!services) return undefined
    const root = await services.pathService.getRootDirectory()
    storageRootRef.current = root
    return root
  }, [services])

  const mapDbMessageToUI = useCallback((msg: any, storageRoot?: string): SessionMessage => {
    return mapSessionMessageFromDb(msg, { storageRoot }) as SessionMessage
  }, [])

  const syncFromCache = useCallback(
    (roundWindowStart: number) => {
      const result = applyCacheToWindow(
        messageCacheRef.current,
        roundWindowStart,
        fetchHasMoreRef.current
      )
      roundWindowStartRef.current = result.roundWindowStart
      setMessages(result.display as any)
      setHasMore(result.hasMore)
      return result
    },
    [setMessages]
  )

  const ingestFetchedTail = useCallback(
    (fetched: SessionMessage[], preserveWindow: boolean) => {
      messageCacheRef.current = dedupeMessagesById(fetched)
      loadedFromEndRef.current = messageCacheRef.current.length
      fetchHasMoreRef.current = fetched.length >= CHAT_MESSAGE_FETCH_LIMIT

      const rounds = groupMessagesIntoRounds(fetched)
      let start = roundWindowStartRef.current

      if (!preserveWindow || start >= Math.max(0, rounds.length - CHAT_ROUNDS_PER_PAGE)) {
        start = computeInitialRoundWindowStart(rounds.length)
      } else {
        start = Math.min(start, computeInitialRoundWindowStart(rounds.length))
      }

      return syncFromCache(start)
    },
    [syncFromCache]
  )

  const refreshSessionMessages = useCallback(
    async (
      sessionId: string,
      options?: {
        preserveWindow?: boolean
        retryCount?: number
        waitForLatestUsage?: boolean
        commitToUi?: boolean
      }
    ) => {
      if (!dbReady || !services) return false

      const retryCount = options?.retryCount ?? 1
      const waitForLatestUsage = options?.waitForLatestUsage ?? false
      const commitToUi = options?.commitToUi ?? true

      let mapped: SessionMessage[] | null = null

      for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
          const storageRoot = await resolveStorageRoot()
          const fetchLimit = Math.max(loadedFromEndRef.current, CHAT_MESSAGE_FETCH_LIMIT)
          const rows = await services.sessionManager.getMessagesBySession(sessionId, fetchLimit, 0)
          mapped = (rows ?? []).map((msg: any) => mapDbMessageToUI(msg, storageRoot))

          const latestAssistant = [...mapped].reverse().find((m) => m.role === 'assistant')
          if (
            waitForLatestUsage &&
            latestAssistant &&
            !messageHasUsageStats(latestAssistant) &&
            attempt < retryCount - 1
          ) {
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
            continue
          }

          break
        } catch (e) {
          console.error('Failed to refresh session messages', e)
          mapped = null
          if (attempt < retryCount - 1) {
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
            continue
          }
        }
      }

      if (!mapped) return false

      const latestAssistant = [...mapped].reverse().find((m) => m.role === 'assistant')
      if (waitForLatestUsage && latestAssistant && !messageHasUsageStats(latestAssistant)) {
        return false
      }

      if (commitToUi) {
        ingestFetchedTail(mapped, options?.preserveWindow ?? false)
      }

      return true
    },
    [dbReady, services, mapDbMessageToUI, ingestFetchedTail, resolveStorageRoot]
  )

  const loadMessages = useCallback(
    async (sessionId: string) => {
      if (!dbReady || !services) return
      resetPaginationRefs(paginationRefs)
      clearSession()
      await refreshSessionMessages(sessionId, { preserveWindow: false })
    },
    [dbReady, services, clearSession, refreshSessionMessages]
  )

  const handleLoadMore = useCallback(async () => {
    if (!dbReady || !currentSessionId || !services || loadMoreLockRef.current) return
    loadMoreLockRef.current = true

    try {
      if (roundWindowStartRef.current > 0) {
        roundWindowStartRef.current = expandRoundWindowStart(roundWindowStartRef.current)
        syncFromCache(roundWindowStartRef.current)
        return
      }

      if (!fetchHasMoreRef.current) {
        setHasMore(false)
        return
      }

      const storageRoot = await resolveStorageRoot()
      const fetched = await services.sessionManager.getMessagesBySession(
        currentSessionId,
        CHAT_MESSAGE_FETCH_LIMIT,
        loadedFromEndRef.current
      )

      if (!fetched?.length) {
        fetchHasMoreRef.current = false
        setHasMore(false)
        return
      }

      fetchHasMoreRef.current = fetched.length >= CHAT_MESSAGE_FETCH_LIMIT
      loadedFromEndRef.current += fetched.length

      const mapped = fetched.map((msg: any) => mapDbMessageToUI(msg, storageRoot))
      const oldStart = roundWindowStartRef.current
      const prependedRoundCount = groupMessagesIntoRounds(mapped).length
      messageCacheRef.current = dedupeMessagesById([...mapped, ...messageCacheRef.current])

      roundWindowStartRef.current = Math.max(
        0,
        oldStart + prependedRoundCount - CHAT_ROUNDS_PER_PAGE
      )
      syncFromCache(roundWindowStartRef.current)
    } catch (e) {
      console.error('Failed to load more messages', e)
    } finally {
      loadMoreLockRef.current = false
    }
  }, [dbReady, currentSessionId, services, mapDbMessageToUI, syncFromCache, resolveStorageRoot])

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      setCurrentSessionId(sessionId)
      await loadMessages(sessionId)
    },
    [loadMessages]
  )

  /** 切换伙伴：清空当前会话，由用户从侧栏手动选择对话 */
  const handleAssistantSwitched = useCallback(
    async (_assistantId: string, _providerId?: string, _modelId?: string) => {
      setCurrentSessionId(null)
      resetPaginationRefs(paginationRefs)
      clearSession()
      setHasMore(false)
    },
    [clearSession]
  )

  const handleCreateSession = useCallback(
    async (options?: { assistantId?: string; providerId?: string; modelId?: string }) => {
      if (!dbReady || !services) return null
      try {
        const newId = Date.now().toString()
        const vaultName = await services.pathService.getActiveVaultNameForContext()
        await services.sessionManager.upsertSession(
          buildInsertSessionInput(
            {
              id: newId,
              title: t('agent.sessions.default_title', '新对话'),
              assistantId: options?.assistantId,
              providerId: options?.providerId,
              modelId: options?.modelId
            },
            vaultName
          )
        )
        resetPaginationRefs(paginationRefs)
        setCurrentSessionId(newId)
        clearSession()
        setHasMore(false)
        return newId
      } catch (e) {
        console.error('Failed to create session', e)
        const msg = e instanceof Error ? e.message : String(e)
        toast.showError(
          t('agent.error.create_session', '由于系统原因创建会话失败: {{msg}}', { msg })
        )
        return null
      }
    },
    [dbReady, services, t, clearSession, toast]
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!services) return
      try {
        await services.sessionManager.deleteSessions([sessionId])
        if (sessionId === currentSessionId) {
          resetSessionState()
        }
      } catch (e) {
        console.error('Failed to delete session', e)
        toast.showError(t('agent.sessions.delete_session', '删除对话'))
      }
    },
    [services, t, currentSessionId, resetSessionState]
  )

  const handlePinSession = useCallback(
    async (sessionId: string, isPinned: boolean) => {
      if (!services) return
      try {
        await services.sessionManager.togglePin(sessionId, !isPinned)
      } catch (e) {
        console.error('Failed to pin session', e)
      }
    },
    [services]
  )

  const handleRenameSession = useCallback(
    async (sessionId: string, newTitle: string) => {
      if (!services || !newTitle.trim()) return
      try {
        await services.sessionManager.updateTitle(sessionId, newTitle.trim())
      } catch (e) {
        console.error('Failed to rename session', e)
      }
    },
    [services]
  )

  useEffect(() => {
    if (vaultSwitching) {
      resetSessionState()
    }
  }, [vaultSwitching, resetSessionState])

  // vault resync / 索引完成后刷新当前对话消息
  useEffect(() => {
    const vaultChanged = lastVaultRevisionRef.current !== vaultRevision
    const ecosystemResynced = lastEcosystemResyncEpochRef.current !== ecosystemResyncEpoch
    lastVaultRevisionRef.current = vaultRevision
    lastEcosystemResyncEpochRef.current = ecosystemResyncEpoch

    if (!vaultChanged && !ecosystemResynced) return
    if (!currentSessionId || vaultSwitching || storageIndexing) return

    void refreshSessionMessages(currentSessionId, { preserveWindow: true })
  }, [
    vaultRevision,
    ecosystemResyncEpoch,
    storageIndexing,
    currentSessionId,
    vaultSwitching,
    refreshSessionMessages
  ])

  return {
    currentSessionId,
    setCurrentSessionId,
    hasMore,
    messages,
    loadMessages,
    refreshSessionMessages,
    handleLoadMore,
    handleSelectSession,
    handleAssistantSwitched,
    handleCreateSession,
    handleDeleteSession,
    handlePinSession,
    handleRenameSession
  }
}
