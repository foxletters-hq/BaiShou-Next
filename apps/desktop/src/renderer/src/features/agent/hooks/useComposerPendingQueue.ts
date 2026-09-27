import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionInputRecord } from '@baishou/shared'
import type { ComposerRuntimeQueueItem } from '../components/ComposerRuntimeQueueBar'
import {
  mergePendingQueueView,
  reconcileOptimisticAfterServer,
  resolvePendingInputId
} from '../utils/pending-queue-messages.util'

function toQueueItems(list: SessionInputRecord[]): ComposerRuntimeQueueItem[] {
  return list.map((item) => ({
    id: item.id,
    text: item.text,
    userMessageId: item.userMessageId
  }))
}

type QueueScope = 'companion' | 'workspace'

function getPendingApi(scope: QueueScope) {
  if (scope === 'workspace') {
    return {
      list: (sessionId: string) => window.api.agentWorkspace.listPendingInputs(sessionId),
      cancel: (inputId: string) => window.api.agentWorkspace.cancelPendingInput(inputId),
      update: (params: { inputId: string; text?: string; delivery?: 'steer' | 'queue' }) =>
        window.api.agentWorkspace.updatePendingInput(params)
    }
  }
  return {
    list: (sessionId: string) => window.api.listPendingInputs(sessionId),
    cancel: (inputId: string) => window.api.cancelPendingInput(inputId),
    update: (params: { inputId: string; text?: string; delivery?: 'steer' | 'queue' }) =>
      window.api.updatePendingInput(params)
  }
}

/**
 * 伴侣 / 工作台共用：拉取 pending inbox，并驱动排队条编辑态。
 */
export function useComposerPendingQueue(params: {
  sessionId?: string
  scope: QueueScope
  refreshTrigger?: unknown
}) {
  const { sessionId, scope, refreshTrigger } = params
  const eventName =
    scope === 'workspace'
      ? 'baishou:workspace-pending-inputs-changed'
      : 'baishou:companion-pending-inputs-changed'
  const api = useMemo(() => getPendingApi(scope), [scope])
  const [pendingQueue, setPendingQueue] = useState<ComposerRuntimeQueueItem[]>([])
  const [editingInputId, setEditingInputId] = useState<string | null>(null)
  const optimisticRef = useRef<ComposerRuntimeQueueItem[]>([])
  const steerWhenReadyRef = useRef<string | null>(null)

  const applyQueue = useCallback((serverItems: ComposerRuntimeQueueItem[]) => {
    optimisticRef.current = reconcileOptimisticAfterServer(serverItems, optimisticRef.current)
    const merged = mergePendingQueueView(serverItems, optimisticRef.current)
    setPendingQueue(merged)
    const steerText = steerWhenReadyRef.current?.trim()
    if (!steerText) return
    const match =
      serverItems.find((item) => item.text.trim() === steerText) ??
      serverItems.find((item) => item.text.includes(steerText) || steerText.includes(item.text.trim()))
    if (!match) return
    steerWhenReadyRef.current = null
    void api.update({ inputId: match.id, delivery: 'steer' })
  }, [api])

  const refreshPending = useCallback(async () => {
    if (!sessionId) {
      optimisticRef.current = []
      setPendingQueue([])
      return
    }
    try {
      const list = await api.list(sessionId)
      applyQueue(toQueueItems(list))
      setEditingInputId((prev) => (prev && list.some((item) => item.id === prev) ? prev : null))
    } catch {
      setPendingQueue(mergePendingQueueView([], optimisticRef.current))
    }
  }, [api, applyQueue, sessionId])

  useEffect(() => {
    void refreshPending()
    const onChanged = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          sessionId?: string
          optimistic?: ComposerRuntimeQueueItem
          dropOptimisticId?: string
          dropInputId?: string
        }>
      ).detail
      if (detail?.sessionId && sessionId && detail.sessionId !== sessionId) return
      if (detail?.dropInputId) {
        optimisticRef.current = optimisticRef.current.filter(
          (item) => item.id !== detail.dropInputId
        )
        setPendingQueue((prev) => prev.filter((item) => item.id !== detail.dropInputId))
      }
      if (detail?.dropOptimisticId) {
        optimisticRef.current = optimisticRef.current.filter(
          (item) => item.id !== detail.dropOptimisticId
        )
      }
      const optimistic = detail?.optimistic
      if (optimistic?.id) {
        optimisticRef.current = [
          ...optimisticRef.current.filter((item) => item.id !== optimistic.id),
          optimistic
        ]
        setPendingQueue((prev) => mergePendingQueueView(prev, [optimistic]))
      }
      void refreshPending()
    }
    window.addEventListener(eventName, onChanged)
    return () => window.removeEventListener(eventName, onChanged)
  }, [eventName, refreshPending, refreshTrigger, sessionId])

  const notifyChanged = useCallback(() => {
    if (!sessionId) return
    window.dispatchEvent(new CustomEvent(eventName, { detail: { sessionId } }))
  }, [eventName, sessionId])

  const cancelEdit = useCallback(() => setEditingInputId(null), [])

  const beginEdit = useCallback((item: ComposerRuntimeQueueItem) => {
    setEditingInputId(item.id)
  }, [])

  const deleteItem = useCallback(
    async (item: ComposerRuntimeQueueItem) => {
      await api.cancel(item.id)
      if (editingInputId === item.id) setEditingInputId(null)
      notifyChanged()
      if (scope === 'workspace') {
        window.dispatchEvent(
          new CustomEvent('baishou:workspace-messages-changed', { detail: { sessionId } })
        )
      }
    },
    [api, editingInputId, notifyChanged, scope, sessionId]
  )

  const sendNow = useCallback(
    async (item: ComposerRuntimeQueueItem) => {
      let inputId = item.id
      if (inputId.startsWith('local-')) {
        if (!sessionId) return
        const list = await api.list(sessionId)
        const resolved = resolvePendingInputId(item, list)
        if (!resolved) {
          steerWhenReadyRef.current = item.text
          return
        }
        inputId = resolved
      }
      await api.update({ inputId, delivery: 'steer' })
      notifyChanged()
    },
    [api, notifyChanged, sessionId]
  )

  const commitEdit = useCallback(
    async (text: string) => {
      if (!editingInputId) return false
      const trimmed = text.trim()
      if (!trimmed) return false
      const updated = await api.update({ inputId: editingInputId, text: trimmed })
      if (!updated) return false
      setEditingInputId(null)
      notifyChanged()
      return true
    },
    [api, editingInputId, notifyChanged]
  )

  return {
    pendingQueue,
    editingInputId,
    refreshPending,
    notifyChanged,
    beginEdit,
    cancelEdit,
    deleteItem,
    sendNow,
    commitEdit
  }
}
