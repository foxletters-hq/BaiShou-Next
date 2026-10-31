import { useState, useEffect, useRef, useCallback } from 'react'
import type { SessionData } from '@baishou/ui'

/** 每页 20 条会话；多取 1 条用于判断是否还有下一页 */
export const SESSION_PAGE_SIZE = 20

export interface LoadDesktopSessionsOptions {
  /** 刷新时保留当前已加载的条数上限，避免后台同步事件把多页列表打回第一页 */
  preserveLoadedCount?: boolean
  /** resetOffset 为 true 时是否滚回顶部（默认在不保留条数时滚回顶部） */
  scrollToTop?: boolean
}

export interface AgentSessionsManager {
  sessions: SessionData[]
  hasMoreSessions: boolean
  isLoadingMoreSessions: boolean
  sidebarScrollKey: number
  loadSessions: (
    resetOffset?: boolean,
    overrideAssistantId?: string,
    options?: LoadDesktopSessionsOptions
  ) => Promise<void>
}

/**
 * 封装 AgentLayout 中的会话列表管理逻辑。
 * 包含加载/分页/竞态保护/file-changed 监听。
 */
export function useAgentSessions(
  activeAssistantId: string | undefined,
  searchQuery: string
): AgentSessionsManager {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [hasMoreSessions, setHasMoreSessions] = useState(false)
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false)
  const [sidebarScrollKey, setSidebarScrollKey] = useState(0)
  const lastLoadRequestId = useRef(0)
  const loadingMoreInFlightRef = useRef(false)
  const assistantIdRef = useRef<string | undefined>(activeAssistantId)
  const searchQueryRef = useRef<string>(searchQuery)
  const sessionsLoadedFromDbRef = useRef(0)

  useEffect(() => {
    assistantIdRef.current = activeAssistantId
  }, [activeAssistantId])

  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  const loadSessions = useCallback(
    async (
      resetOffset = false,
      overrideAssistantId?: string,
      options?: LoadDesktopSessionsOptions
    ) => {
      try {
        if (typeof window === 'undefined' || !window.electron) return
        if (!resetOffset && loadingMoreInFlightRef.current) return

        const reqId = ++lastLoadRequestId.current
        const offset = resetOffset ? 0 : sessionsLoadedFromDbRef.current
        const targetAst = overrideAssistantId || assistantIdRef.current
        if (!targetAst) return

        if (overrideAssistantId) {
          assistantIdRef.current = overrideAssistantId
          lastActiveAssistantId.current = overrideAssistantId
        }

        const preserveLoadedCount = Boolean(resetOffset && options?.preserveLoadedCount)
        const targetLimit =
          preserveLoadedCount && sessionsLoadedFromDbRef.current > SESSION_PAGE_SIZE
            ? sessionsLoadedFromDbRef.current
            : SESSION_PAGE_SIZE

        if (!resetOffset) {
          loadingMoreInFlightRef.current = true
          setIsLoadingMoreSessions(true)
        }

        const data = await window.electron.ipcRenderer.invoke(
          'agent:get-sessions',
          targetLimit + 1,
          offset,
          targetAst,
          searchQueryRef.current
        )

        if (reqId !== lastLoadRequestId.current) return

        if (data && data.length > 0) {
          const hasMore = data.length > targetLimit
          const page = hasMore ? data.slice(0, targetLimit) : data

          if (resetOffset) {
            setSessions(page)
            sessionsLoadedFromDbRef.current = page.length
            const shouldScrollTop = options?.scrollToTop ?? !preserveLoadedCount
            if (shouldScrollTop) {
              setSidebarScrollKey((prev) => prev + 1)
            }
          } else {
            setSessions((prev) => {
              const existing = new Set(prev.map((s) => s.id))
              const merged = [...prev]
              for (const row of page) {
                if (!existing.has(row.id)) merged.push(row)
              }
              return merged
            })
            sessionsLoadedFromDbRef.current += page.length
          }
          setHasMoreSessions(hasMore)
        } else {
          if (resetOffset) {
            setSessions([])
            sessionsLoadedFromDbRef.current = 0
          }
          setHasMoreSessions(false)
        }
      } catch (e) {
        console.error('[useAgentSessions] Failed to load sessions:', e)
      } finally {
        if (!resetOffset) {
          loadingMoreInFlightRef.current = false
          setIsLoadingMoreSessions(false)
        }
      }
    },
    []
  )

  const lastActiveAssistantId = useRef<string | undefined>(activeAssistantId)
  useEffect(() => {
    const isAssistantChanged = lastActiveAssistantId.current !== activeAssistantId
    lastActiveAssistantId.current = activeAssistantId

    if (!activeAssistantId) {
      setSessions([])
      setHasMoreSessions(false)
      sessionsLoadedFromDbRef.current = 0
      return
    }

    if (isAssistantChanged) {
      lastLoadRequestId.current += 1
      sessionsLoadedFromDbRef.current = 0
      setSessions([])
      setHasMoreSessions(false)
      void loadSessions(true, activeAssistantId)
    } else {
      const timer = setTimeout(() => {
        sessionsLoadedFromDbRef.current = 0
        void loadSessions(true, activeAssistantId)
      }, 300)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [activeAssistantId, searchQuery, loadSessions])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return undefined
    const handler = () =>
      loadSessions(true, assistantIdRef.current, {
        preserveLoadedCount: true,
        scrollToTop: false
      })
    const removeListener = window.electron.ipcRenderer.on('session:file-changed', handler)
    return () => removeListener()
  }, [loadSessions])

  return {
    sessions,
    hasMoreSessions,
    isLoadingMoreSessions,
    sidebarScrollKey,
    loadSessions
  }
}
