import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { SessionData } from '@baishou/ui'

const SESSION_LIMIT = 10

export interface AgentSessionsManager {
  sessions: SessionData[]
  hasMoreSessions: boolean
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
  const [sidebarScrollKey, setSidebarScrollKey] = useState(0)
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const lastLoadRequestId = useRef(0)
  const assistantIdRef = useRef<string | undefined>(activeAssistantId)
  const searchQueryRef = useRef<string>(searchQuery)
  const sessionsLengthRef = useRef(0)

  useEffect(() => {
    assistantIdRef.current = activeAssistantId
  }, [activeAssistantId])

  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  useEffect(() => {
    sessionsLengthRef.current = sessions.length
  }, [sessions.length])

  const loadSessions = useCallback(async (resetOffset = false, overrideAssistantId?: string) => {
    try {
      if (typeof window === 'undefined' || !window.electron) return
      const reqId = ++lastLoadRequestId.current
      const offset = resetOffset ? 0 : sessionsLengthRef.current
      const targetAst = overrideAssistantId || assistantIdRef.current
      if (!targetAst) return

      const data = await window.electron.ipcRenderer.invoke(
        'agent:get-sessions',
        SESSION_LIMIT,
        offset,
        targetAst,
        searchQueryRef.current
      )

      if (reqId !== lastLoadRequestId.current) return

      if (data && data.length > 0) {
        setSessions((prev) => (resetOffset ? data : [...prev, ...data]))
        setHasMoreSessions(data.length === SESSION_LIMIT)
      } else {
        if (resetOffset) setSessions([])
        setHasMoreSessions(false)
      }
      if (resetOffset) setSidebarScrollKey((prev) => prev + 1)
    } catch (e) {
      console.error('[useAgentSessions] Failed to load sessions:', e)
    }
  }, [])

  // 当助手或搜索词变化时，触发加载（对搜索词使用防抖，对助手直接触发）
  const lastActiveAssistantId = useRef<string | undefined>(activeAssistantId)
  useEffect(() => {
    const isAssistantChanged = lastActiveAssistantId.current !== activeAssistantId
    lastActiveAssistantId.current = activeAssistantId

    if (!activeAssistantId) {
      setSessions([])
      setHasMoreSessions(false)
      return
    }

    if (isAssistantChanged) {
      // 助手切换，立刻执行，不防抖并清空旧会话
      lastLoadRequestId.current += 1
      setSessions([])
      setHasMoreSessions(false)
      void loadSessions(true, activeAssistantId)
    } else {
      // 搜索词变化，防抖 300ms
      const timer = setTimeout(() => {
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
    sidebarScrollKey,
    loadSessions,
    renameTarget,
    renameInputRef,
    setRenameTarget,
    handleRenameSession,
    commitRename
  }
}
