import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentSession } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

/** 每页 10 条；多取 1 条用于判断是否还有下一页（对齐桌面端 useAgentSessions） */
export const SESSION_PAGE_SIZE = 10

const SESSION_LIST_REFRESH_DEBOUNCE_MS = 300

export function useAgentSessions(activeAssistantId: string | undefined) {
  const { t } = useTranslation()
  const { services, dbReady, vaultRevision, ecosystemResyncEpoch } = useBaishou()

  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [hasMoreSessions, setHasMoreSessions] = useState(false)
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false)
  const [sessionListScrollKey, setSessionListScrollKey] = useState(0)

  const lastLoadRequestId = useRef(0)
  const assistantIdRef = useRef<string | undefined>(activeAssistantId)
  const sessionsLoadedFromDbRef = useRef(0)
  const lastVaultRevisionRef = useRef(vaultRevision)
  const lastEcosystemResyncEpochRef = useRef(ecosystemResyncEpoch)

  useEffect(() => {
    assistantIdRef.current = activeAssistantId
  }, [activeAssistantId])

  const mapSession = useCallback(
    (s: {
      id: string
      title?: string | null
      isPinned?: boolean | null
      updatedAt?: string | Date | null
      createdAt?: string | Date | null
      messageCount?: number | null
    }): AgentSession => ({
      id: s.id,
      title: s.title || t('agent.sessions.default_title', '新对话'),
      isPinned: Boolean(s.isPinned),
      lastMessageAt: s.updatedAt
        ? new Date(s.updatedAt).getTime()
        : s.createdAt
          ? new Date(s.createdAt).getTime()
          : Date.now(),
      messageCount: s.messageCount ?? 0
    }),
    [t]
  )

  const loadSessions = useCallback(
    async (resetOffset = false, overrideAssistantId?: string) => {
      if (!dbReady || !services) return

      const targetAssistantId = overrideAssistantId || assistantIdRef.current
      if (!targetAssistantId) return

      const reqId = ++lastLoadRequestId.current
      const offset = resetOffset ? 0 : sessionsLoadedFromDbRef.current

      if (!resetOffset) {
        setIsLoadingMoreSessions(true)
      }

      try {
        const sessionList = await services.sessionManager.list(
          SESSION_PAGE_SIZE + 1,
          offset,
          targetAssistantId
        )

        if (reqId !== lastLoadRequestId.current) return

        if (sessionList && sessionList.length > 0) {
          const hasMore = sessionList.length > SESSION_PAGE_SIZE
          const page = hasMore ? sessionList.slice(0, SESSION_PAGE_SIZE) : sessionList
          const mapped = page.map(mapSession)

          if (resetOffset) {
            setSessions(mapped)
            sessionsLoadedFromDbRef.current = sessionList.length
            setSessionListScrollKey((prev) => prev + 1)
          } else {
            setSessions((prev) => {
              const existing = new Set(prev.map((s) => s.id))
              const merged = [...prev]
              for (const row of mapped) {
                if (!existing.has(row.id)) merged.push(row)
              }
              return merged
            })
            sessionsLoadedFromDbRef.current += sessionList.length
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
        if (reqId === lastLoadRequestId.current) {
          setIsLoadingMoreSessions(false)
        }
      }
    },
    [dbReady, services, mapSession]
  )

  const lastActiveAssistantId = useRef<string | undefined>(activeAssistantId)
  useEffect(() => {
    const isAssistantChanged = lastActiveAssistantId.current !== activeAssistantId
    lastActiveAssistantId.current = activeAssistantId

    if (!activeAssistantId) {
      lastLoadRequestId.current += 1
      sessionsLoadedFromDbRef.current = 0
      setSessions([])
      setHasMoreSessions(false)
      return
    }

    if (isAssistantChanged) {
      lastLoadRequestId.current += 1
      sessionsLoadedFromDbRef.current = 0
      setSessions([])
      setHasMoreSessions(false)
      void loadSessions(true, activeAssistantId)
      return
    }

    const timer = setTimeout(() => {
      sessionsLoadedFromDbRef.current = 0
      void loadSessions(true, activeAssistantId)
    }, SESSION_LIST_REFRESH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [activeAssistantId, loadSessions])

  // vault 切换或后台索引完成后刷新会话列表
  useEffect(() => {
    const vaultChanged = lastVaultRevisionRef.current !== vaultRevision
    const ecosystemResynced = lastEcosystemResyncEpochRef.current !== ecosystemResyncEpoch
    lastVaultRevisionRef.current = vaultRevision
    lastEcosystemResyncEpochRef.current = ecosystemResyncEpoch

    if (!vaultChanged && !ecosystemResynced) return
    if (!activeAssistantId) return

    const timer = setTimeout(() => {
      sessionsLoadedFromDbRef.current = 0
      void loadSessions(true, activeAssistantId)
    }, SESSION_LIST_REFRESH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [vaultRevision, ecosystemResyncEpoch, activeAssistantId, loadSessions])

  return {
    sessions,
    hasMoreSessions,
    isLoadingMoreSessions,
    sessionListScrollKey,
    loadSessions
  }
}
