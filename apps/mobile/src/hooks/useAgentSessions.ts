import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { deriveLegacyVaultId } from '@baishou/shared'
import type { AgentSession } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { subscribeMobileSessionChanged } from '../services/mobile-session-events'

/** 每页 20 条；多取 1 条用于判断是否还有下一页（对齐桌面端 useAgentSessions） */
export const SESSION_PAGE_SIZE = 20

const SESSION_LIST_REFRESH_DEBOUNCE_MS = 300
const SESSION_SEARCH_DEBOUNCE_MS = 200

export interface LoadSessionsOptions {
  /** 刷新时保留当前已加载的条数上限，避免把已翻多页的列表打回第一页 */
  preserveLoadedCount?: boolean
  /** resetOffset 为 true 时是否滚回顶部（默认在不保留条数时滚回顶部） */
  scrollToTop?: boolean
}

export function useAgentSessions(activeAssistantId: string | undefined) {
  const { t } = useTranslation()
  const { services, dbReady, vaultRevision, ecosystemResyncEpoch } = useBaishou()

  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [hasMoreSessions, setHasMoreSessions] = useState(false)
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false)
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false)
  const [sessionSearchQuery, setSessionSearchQuery] = useState('')
  const [sessionListScrollKey, setSessionListScrollKey] = useState(0)

  const lastLoadRequestId = useRef(0)
  const loadingMoreInFlightRef = useRef(false)
  const assistantIdRef = useRef<string | undefined>(activeAssistantId)
  const searchQueryRef = useRef(sessionSearchQuery)
  const sessionsLoadedFromDbRef = useRef(0)
  const lastVaultRevisionRef = useRef(vaultRevision)
  const lastEcosystemResyncEpochRef = useRef(ecosystemResyncEpoch)
  const lastDbReadyRef = useRef(dbReady)

  useEffect(() => {
    assistantIdRef.current = activeAssistantId
  }, [activeAssistantId])

  useEffect(() => {
    searchQueryRef.current = sessionSearchQuery
  }, [sessionSearchQuery])

  const mapSession = useCallback(
    (s: {
      id: string
      title?: string | null
      isPinned?: boolean | null
      updatedAt?: string | Date | null
      createdAt?: string | Date | null
      messageCount?: number | null
      snippet?: string | null
    }): AgentSession => ({
      id: s.id,
      title: s.title || t('agent.sessions.default_title', '新对话'),
      isPinned: Boolean(s.isPinned),
      lastMessageAt: s.updatedAt
        ? new Date(s.updatedAt).getTime()
        : s.createdAt
          ? new Date(s.createdAt).getTime()
          : Date.now(),
      messageCount: s.messageCount ?? 0,
      snippet: s.snippet ?? undefined
    }),
    [t]
  )

  const loadSessions = useCallback(
    async (resetOffset = false, overrideAssistantId?: string, options?: LoadSessionsOptions) => {
      if (!dbReady || !services) return

      const targetAssistantId = overrideAssistantId || assistantIdRef.current
      if (!targetAssistantId) return

      if (!resetOffset && loadingMoreInFlightRef.current) return

      const reqId = ++lastLoadRequestId.current
      const offset = resetOffset ? 0 : sessionsLoadedFromDbRef.current
      const preserveLoadedCount = Boolean(resetOffset && options?.preserveLoadedCount)
      const targetLimit =
        preserveLoadedCount && sessionsLoadedFromDbRef.current > SESSION_PAGE_SIZE
          ? sessionsLoadedFromDbRef.current
          : SESSION_PAGE_SIZE

      if (!resetOffset) {
        loadingMoreInFlightRef.current = true
        setIsLoadingMoreSessions(true)
      }

      try {
        const activeVault = services.vaultService?.getActiveVault?.()
        const activeVaultId =
          activeVault?.id ??
          deriveLegacyVaultId(
            (await services.pathService
              ?.getActiveVaultNameForContext?.()
              .catch(() => 'Personal')) || 'Personal'
          )
        const normalizedQuery = searchQueryRef.current.trim() || undefined
        const sessionList = await services.sessionManager.list(
          targetLimit + 1,
          offset,
          targetAssistantId.trim(),
          normalizedQuery,
          activeVaultId
        )

        if (reqId !== lastLoadRequestId.current) return

        if (sessionList && sessionList.length > 0) {
          const hasMore = sessionList.length > targetLimit
          const page = hasMore ? sessionList.slice(0, targetLimit) : sessionList
          const mapped = page.map(mapSession)

          if (resetOffset) {
            setSessions(mapped)
            sessionsLoadedFromDbRef.current = page.length
            const shouldScrollTop = options?.scrollToTop ?? !preserveLoadedCount
            if (shouldScrollTop) {
              setSessionListScrollKey((prev) => prev + 1)
            }
          } else {
            setSessions((prev) => {
              const existing = new Set(prev.map((s) => s.id))
              const merged = [...prev]
              for (const row of mapped) {
                if (!existing.has(row.id)) merged.push(row)
              }
              return merged
            })
            sessionsLoadedFromDbRef.current += page.length
          }
          setHasMoreSessions(hasMore)
        } else if (resetOffset) {
          setSessions([])
          sessionsLoadedFromDbRef.current = 0
          setHasMoreSessions(false)
        } else {
          setHasMoreSessions(false)
        }
      } catch (e) {
        console.warn('Failed to load sessions', e)
      } finally {
        if (!resetOffset) {
          loadingMoreInFlightRef.current = false
          setIsLoadingMoreSessions(false)
        }
      }
    },
    [dbReady, services, mapSession]
  )

  const refreshSessions = useCallback(async () => {
    if (!dbReady || !services || !assistantIdRef.current) return
    setIsRefreshingSessions(true)
    try {
      await loadSessions(true, assistantIdRef.current, {
        preserveLoadedCount: true,
        scrollToTop: false
      })
    } finally {
      setIsRefreshingSessions(false)
    }
  }, [dbReady, services, loadSessions])

  const lastActiveAssistantId = useRef<string | undefined>(activeAssistantId)
  useEffect(() => {
    const isAssistantChanged = lastActiveAssistantId.current !== activeAssistantId
    const dbBecameReady = !lastDbReadyRef.current && dbReady
    lastDbReadyRef.current = dbReady
    lastActiveAssistantId.current = activeAssistantId

    if (!activeAssistantId || !dbReady) {
      if (!activeAssistantId) {
        lastLoadRequestId.current += 1
        sessionsLoadedFromDbRef.current = 0
        setSessions([])
        setHasMoreSessions(false)
      }
      return
    }

    if (isAssistantChanged || dbBecameReady) {
      if (isAssistantChanged) {
        searchQueryRef.current = ''
        setSessionSearchQuery('')
      }
      lastLoadRequestId.current += 1
      sessionsLoadedFromDbRef.current = 0
      setSessions([])
      setHasMoreSessions(false)
      void loadSessions(true, activeAssistantId)
      return
    }

    const timer = setTimeout(() => {
      void loadSessions(true, activeAssistantId, {
        preserveLoadedCount: true,
        scrollToTop: false
      })
    }, SESSION_LIST_REFRESH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [activeAssistantId, dbReady, loadSessions])

  // 搜索词变化时走数据库检索（同时匹配标题与消息正文）
  const lastSearchQueryRef = useRef(sessionSearchQuery)
  useEffect(() => {
    if (lastSearchQueryRef.current === sessionSearchQuery) return
    lastSearchQueryRef.current = sessionSearchQuery
    if (!activeAssistantId || !dbReady) return

    const delay = sessionSearchQuery.trim() ? SESSION_SEARCH_DEBOUNCE_MS : 0
    const timer = setTimeout(() => {
      sessionsLoadedFromDbRef.current = 0
      void loadSessions(true, activeAssistantId, { scrollToTop: true })
    }, delay)

    return () => clearTimeout(timer)
  }, [sessionSearchQuery, activeAssistantId, dbReady, loadSessions])

  // vault 切换或后台索引完成后刷新会话列表
  useEffect(() => {
    const vaultChanged = lastVaultRevisionRef.current !== vaultRevision
    const ecosystemResynced = lastEcosystemResyncEpochRef.current !== ecosystemResyncEpoch
    lastVaultRevisionRef.current = vaultRevision
    lastEcosystemResyncEpochRef.current = ecosystemResyncEpoch

    if (!vaultChanged && !ecosystemResynced) return
    if (!activeAssistantId || !dbReady) return

    const timer = setTimeout(() => {
      if (vaultChanged) {
        sessionsLoadedFromDbRef.current = 0
      }
      void loadSessions(true, activeAssistantId, {
        preserveLoadedCount: !vaultChanged,
        scrollToTop: vaultChanged
      })
    }, SESSION_LIST_REFRESH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [vaultRevision, ecosystemResyncEpoch, activeAssistantId, dbReady, loadSessions])

  // 监听会话变更（如命名模型生成新标题并落盘）实时刷新列表，保留已分页加载深度
  useEffect(() => {
    return subscribeMobileSessionChanged(() => {
      void loadSessions(true, assistantIdRef.current, {
        preserveLoadedCount: true,
        scrollToTop: false
      })
    })
  }, [loadSessions])

  return {
    sessions,
    hasMoreSessions,
    isLoadingMoreSessions,
    isRefreshingSessions,
    sessionSearchQuery,
    setSessionSearchQuery,
    sessionListScrollKey,
    loadSessions,
    refreshSessions
  }
}
