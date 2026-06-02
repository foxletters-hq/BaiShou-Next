import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { SessionData } from '@baishou/ui'

/** 每页 10 条会话；多取 1 条用于判断是否还有下一页 */
export const SESSION_PAGE_SIZE = 10

export interface AgentSessionsManager {
  sessions: SessionData[]
  hasMoreSessions: boolean
  isLoadingMoreSessions: boolean
  sidebarScrollKey: number
  loadSessions: (resetOffset?: boolean, overrideAssistantId?: string) => Promise<void>
  renameTarget: { id: string; title: string } | null
  renameInputRef: React.RefObject<HTMLInputElement>
  setRenameTarget: (target: { id: string; title: string } | null) => void
  handleRenameSession: (id: string, sessions: SessionData[]) => void
  commitRename: (onSuccess: (title: string) => void) => Promise<void>
}

/**
 * 封装 AgentLayout 中的会话列表管理逻辑。
 * 包含加载/分页/竞态保护/file-changed 监听/内联重命名状态。
 */
export function useAgentSessions(
  activeAssistantId: string | undefined,
  searchQuery: string
): AgentSessionsManager {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [hasMoreSessions, setHasMoreSessions] = useState(false)
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false)
  const [sidebarScrollKey, setSidebarScrollKey] = useState(0)
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const lastLoadRequestId = useRef(0)
  const assistantIdRef = useRef<string | undefined>(activeAssistantId)
  const searchQueryRef = useRef<string>(searchQuery)
  const sessionsLoadedFromDbRef = useRef(0)

  useEffect(() => {
    assistantIdRef.current = activeAssistantId
  }, [activeAssistantId])

  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  const loadSessions = useCallback(async (resetOffset = false, overrideAssistantId?: string) => {
    try {
      if (typeof window === 'undefined' || !window.electron) return
      const reqId = ++lastLoadRequestId.current
      const offset = resetOffset ? 0 : sessionsLoadedFromDbRef.current
      const targetAst = overrideAssistantId || assistantIdRef.current
      if (!targetAst) return

      if (!resetOffset) {
        setIsLoadingMoreSessions(true)
      }

      const data = await window.electron.ipcRenderer.invoke(
        'agent:get-sessions',
        SESSION_PAGE_SIZE + 1,
        offset,
        targetAst,
        searchQueryRef.current
      )

      if (reqId !== lastLoadRequestId.current) return

      if (data && data.length > 0) {
        const hasMore = data.length > SESSION_PAGE_SIZE
        const page = hasMore ? data.slice(0, SESSION_PAGE_SIZE) : data

        if (resetOffset) {
          setSessions(page)
          sessionsLoadedFromDbRef.current = data.length
          setSidebarScrollKey((prev) => prev + 1)
        } else {
          setSessions((prev) => {
            const existing = new Set(prev.map((s) => s.id))
            const merged = [...prev]
            for (const row of page) {
              if (!existing.has(row.id)) merged.push(row)
            }
            return merged
          })
          sessionsLoadedFromDbRef.current += data.length
        }
        setHasMoreSessions(hasMore)
      } else {
        if (resetOffset) setSessions([])
        setHasMoreSessions(false)
      }
    } catch (e) {
      console.error('[useAgentSessions] Failed to load sessions:', e)
    } finally {
      setIsLoadingMoreSessions(false)
    }
  }, [])

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
    const handler = () => loadSessions(true, assistantIdRef.current)
    const removeListener = window.electron.ipcRenderer.on('session:file-changed', handler)
    return () => removeListener()
  }, [loadSessions])

  const handleRenameSession = (id: string, currentSessions: SessionData[]) => {
    const s = currentSessions.find((s) => s.id === id)
    if (!s) return
    setRenameTarget({ id, title: s.title || '' })
    setTimeout(() => renameInputRef.current?.select(), 50)
  }

  const commitRename = async (onSuccess: (title: string) => void) => {
    if (!renameTarget) return
    const newTitle = renameTarget.title.trim()
    if (newTitle && window.electron) {
      await window.electron.ipcRenderer.invoke(
        'agent:update-session-title',
        renameTarget.id,
        newTitle
      )
      loadSessions(true)
      onSuccess(newTitle)
    }
    setRenameTarget(null)
  }

  return {
    sessions,
    hasMoreSessions,
    isLoadingMoreSessions,
    sidebarScrollKey,
    loadSessions,
    renameTarget,
    renameInputRef,
    setRenameTarget,
    handleRenameSession,
    commitRename
  }
}
