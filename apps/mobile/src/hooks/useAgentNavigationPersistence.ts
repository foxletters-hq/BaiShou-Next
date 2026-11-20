import { useEffect, useRef, useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useAgentNavigationStore } from '@baishou/store'
import type { MobileAssistantUi } from '../lib/mobile-assistant.util'
import {
  loadMobileSessionInActiveVault,
  resolveMobileSessionVaultCandidateIds
} from '../utils/mobile-session-vault.util'
import {
  readAgentNavigationSnapshot,
  writeAgentNavigationSnapshot
} from '../lib/agent-navigation-persistence'
import {
  shouldPersistNavigationImmediately,
  shouldSkipNavigationPersistBeforeRestore,
  shouldSkipSessionRestoreForAssistantMismatch,
  shouldThrottleNavigationReconcile
} from '../lib/agent-navigation-restore.util'

type SessionRow = { id: string; assistantId?: string | null; vaultId?: string | null }

type Services = {
  pathService: { getActiveVaultNameForContext: () => Promise<string> }
  sessionManager: {
    getSessionById: (sessionId: string) => Promise<SessionRow | null>
    notifySessionMutated?: (sessionId: string) => void
    list?: (
      limit?: number,
      offset?: number,
      assistantId?: string,
      searchQuery?: string,
      vaultId?: string | string[]
    ) => Promise<Array<{ id: string }>>
  }
  sessionRepo?: {
    updateSessionVaultId?: (sessionId: string, vaultId: string) => Promise<void>
  }
  vaultService?: {
    getActiveVault?: () => { id?: string; name?: string } | null
    getAllVaults?: () => Array<{ id?: string; name?: string }>
  }
}

type UseAgentNavigationPersistenceOptions = {
  dbReady: boolean
  vaultSwitching: boolean
  vaultRevision: number
  restorePrefReady?: boolean
  restoreLastSessionOnReturn?: boolean
  services: Services | null
  assistants: MobileAssistantUi[]
  currentAssistant: MobileAssistantUi | null
  currentSessionId: string | null
  handleSelectAssistant: (assistant: MobileAssistantUi) => void
  handleSelectSession: (sessionId: string) => Promise<void>
  loadSessions: (resetOffset?: boolean, overrideAssistantId?: string) => Promise<void>
  clearSession: () => void
  invalidateCurrentSession: () => void
}

const RECONCILE_THROTTLE_MS = 2000

async function lookupSession(services: Services, sessionId: string): Promise<SessionRow | null> {
  const session = await loadMobileSessionInActiveVault(services, sessionId)
  if (!session) return null
  return {
    id: sessionId,
    assistantId: (session as SessionRow).assistantId ?? null,
    vaultId: session.vaultId
  }
}

export function useAgentNavigationPersistence({
  dbReady,
  vaultSwitching,
  vaultRevision,
  restorePrefReady = true,
  restoreLastSessionOnReturn = true,
  services,
  assistants,
  currentAssistant,
  currentSessionId,
  handleSelectAssistant,
  handleSelectSession,
  loadSessions,
  clearSession,
  invalidateCurrentSession
}: UseAgentNavigationPersistenceOptions) {
  const hydratedRef = useRef(false)
  const hydratedVaultKeyRef = useRef<string | null>(null)
  const initialRestoreDoneRef = useRef(false)
  const restoringRef = useRef(false)
  const lastPersistedRef = useRef<string>('')
  const prevSessionIdRef = useRef<string | null>(null)
  const prevAssistantIdRef = useRef<string | null>(null)
  const lastReconcileAtRef = useRef(0)
  const lastReconcileKeyRef = useRef('')
  const currentSessionIdRef = useRef<string | null>(currentSessionId)
  const currentAssistantIdRef = useRef<string | null>(currentAssistant?.id ?? null)
  const vaultSwitchingRef = useRef(vaultSwitching)
  const [navigationHydrationEpoch, setNavigationHydrationEpoch] = useState(0)

  currentSessionIdRef.current = currentSessionId
  currentAssistantIdRef.current = currentAssistant?.id ?? null
  vaultSwitchingRef.current = vaultSwitching

  const listRecentSessionsForAssistant = useCallback(
    async (assistantId: string): Promise<Array<{ id: string }>> => {
      if (!services?.sessionManager.list || vaultSwitchingRef.current) return []
      const vaultCandidateIds = resolveMobileSessionVaultCandidateIds(services)
      return services.sessionManager
        .list(1, 0, assistantId, undefined, vaultCandidateIds)
        .catch(() => [])
    },
    [services]
  )

  const persistSnapshot = useCallback(
    async (
      snapshot: { assistantId: string | null; sessionId: string | null },
      explicitVaultKey?: string | null
    ) => {
      if (!services || vaultSwitchingRef.current) return
      const vaultKey = explicitVaultKey ?? hydratedVaultKeyRef.current
      if (!vaultKey) return
      const serialized = `${vaultKey}:${JSON.stringify(snapshot)}`
      if (serialized === lastPersistedRef.current) return
      lastPersistedRef.current = serialized
      useAgentNavigationStore.getState().setContext(vaultKey, snapshot)
      await writeAgentNavigationSnapshot(vaultKey, snapshot)
    },
    [services]
  )

  useEffect(() => {
    hydratedRef.current = false
    hydratedVaultKeyRef.current = null
    initialRestoreDoneRef.current = false
    restoringRef.current = false
    prevAssistantIdRef.current = null
    prevSessionIdRef.current = null
    if (!dbReady || !services || vaultSwitching) return

    let cancelled = false
    void (async () => {
      const vaultKey = await services.pathService.getActiveVaultNameForContext()
      const saved = await readAgentNavigationSnapshot(vaultKey)
      if (cancelled || vaultSwitchingRef.current) return
      if (saved) {
        useAgentNavigationStore.getState().setContext(vaultKey, saved)
        lastPersistedRef.current = `${vaultKey}:${JSON.stringify(saved)}`
      } else {
        useAgentNavigationStore.getState().clearContext(vaultKey)
        lastPersistedRef.current = ''
      }
      hydratedVaultKeyRef.current = vaultKey
      hydratedRef.current = true
      setNavigationHydrationEpoch((epoch) => epoch + 1)
    })()

    return () => {
      cancelled = true
      restoringRef.current = false
    }
  }, [dbReady, services, vaultRevision, vaultSwitching])

  useEffect(() => {
    if (!restorePrefReady) return
    if (!restoreLastSessionOnReturn && currentSessionId) {
      clearSession()
    }
  }, [clearSession, currentSessionId, restoreLastSessionOnReturn, restorePrefReady])

  const restoreSavedOrRecentSession = useCallback(
    async (options: {
      vaultKey: string
      saved: { assistantId: string | null; sessionId: string | null }
      logRestoreAttempt?: boolean
      isCancelled?: () => boolean
    }): Promise<boolean> => {
      const { vaultKey, saved, logRestoreAttempt = false, isCancelled } = options
      if (!services) return false
      const isStale = () =>
        Boolean(isCancelled?.()) ||
        vaultSwitchingRef.current ||
        hydratedVaultKeyRef.current !== vaultKey

      let assistantToUse = currentAssistant
      if (saved.assistantId) {
        const assistant = assistants.find((item) => item.id === saved.assistantId)
        if (assistant && assistant.id !== currentAssistant?.id) {
          handleSelectAssistant(assistant)
          assistantToUse = assistant
        }
      }

      if (saved.sessionId) {
        if (logRestoreAttempt) {
          console.log('[useAgentNavigation] 尝试恢复持久化选中的会话:', {
            vaultKey,
            sessionId: saved.sessionId,
            savedAssistantId: saved.assistantId
          })
        }
        const session = await lookupSession(services, saved.sessionId)
        if (isStale()) return true
        if (!session) {
          if (logRestoreAttempt) {
            console.warn(
              '[useAgentNavigation] 持久化会话未找到或无法在此小窝中加载，尝试恢复伙伴最新会话:',
              saved.sessionId
            )
          }
          const recent = assistantToUse?.id
            ? await listRecentSessionsForAssistant(assistantToUse.id)
            : []
          if (isStale()) return true
          if (recent.length > 0 && recent[0]?.id) {
            await handleSelectSession(recent[0].id)
            void loadSessions(true, assistantToUse?.id)
            return true
          }
          // 清除已被拦截/失效的脏持久化会话 ID，避免下次切回此小窝重复恢复跨小窝会话
          await persistSnapshot(
            { assistantId: assistantToUse?.id ?? null, sessionId: null },
            vaultKey
          )
          invalidateCurrentSession()
          return true
        }

        const sessionAssistantId = session.assistantId ?? saved.assistantId ?? null
        if (sessionAssistantId && sessionAssistantId !== assistantToUse?.id) {
          const assistant = assistants.find((item) => item.id === sessionAssistantId)
          if (assistant) {
            handleSelectAssistant(assistant)
            assistantToUse = assistant
          }
        }

        await handleSelectSession(saved.sessionId)
        void loadSessions(true, assistantToUse?.id ?? sessionAssistantId ?? undefined)
        return true
      }

      // 快照无 sessionId，但开启了「返回后继续上次会话」且已确定助手：兜底恢复最新会话
      if (assistantToUse?.id) {
        const recent = await listRecentSessionsForAssistant(assistantToUse.id)
        if (!isStale() && recent.length > 0 && recent[0]?.id) {
          await handleSelectSession(recent[0].id)
          void loadSessions(true, assistantToUse.id)
          return true
        }
      }
      return false
    },
    [
      assistants,
      currentAssistant,
      handleSelectAssistant,
      handleSelectSession,
      invalidateCurrentSession,
      listRecentSessionsForAssistant,
      loadSessions,
      persistSnapshot,
      services
    ]
  )

  useEffect(() => {
    if (!hydratedRef.current || !dbReady || !services || vaultSwitching || restoringRef.current) {
      return
    }
    if (initialRestoreDoneRef.current) return
    if (!restorePrefReady) return
    if (!restoreLastSessionOnReturn) {
      initialRestoreDoneRef.current = true
      if (currentSessionId) {
        clearSession()
      }
      return
    }
    if (currentSessionId) {
      initialRestoreDoneRef.current = true
      return
    }
    if (assistants.length === 0) return

    const vaultKey = hydratedVaultKeyRef.current
    if (!vaultKey) return

    let cancelled = false
    restoringRef.current = true

    void (async () => {
      try {
        const saved = useAgentNavigationStore.getState().getContext(vaultKey)
        if (!saved.sessionId && !saved.assistantId) return

        const handled = await restoreSavedOrRecentSession({
          vaultKey,
          saved,
          logRestoreAttempt: true,
          isCancelled: () => cancelled
        })
        if (handled) return

        if (!currentSessionId) {
          clearSession()
        }
      } finally {
        if (!cancelled) {
          restoringRef.current = false
          initialRestoreDoneRef.current = true
        }
      }
    })()

    return () => {
      cancelled = true
      restoringRef.current = false
    }
  }, [
    assistants.length,
    clearSession,
    currentSessionId,
    dbReady,
    navigationHydrationEpoch,
    restoreLastSessionOnReturn,
    restorePrefReady,
    restoreSavedOrRecentSession,
    services,
    vaultSwitching
  ])

  useEffect(() => {
    if (!hydratedRef.current || !dbReady || !services || vaultSwitching || restoringRef.current) {
      return
    }

    if (
      shouldSkipNavigationPersistBeforeRestore({
        restoreLastSessionOnReturn,
        initialRestoreDone: initialRestoreDoneRef.current,
        currentSessionId
      })
    ) {
      return
    }

    const snapshot = {
      assistantId: currentAssistant?.id ?? null,
      sessionId: restoreLastSessionOnReturn ? currentSessionId : null
    }

    const prevSessionId = prevSessionIdRef.current
    prevSessionIdRef.current = currentSessionId

    const assistantChanged = currentAssistant?.id !== prevAssistantIdRef.current
    const sessionChanged = prevSessionId !== currentSessionId
    if (assistantChanged) {
      prevAssistantIdRef.current = currentAssistant?.id ?? null
    }

    if (
      shouldPersistNavigationImmediately({
        assistantChanged,
        sessionCleared: Boolean(prevSessionId && !currentSessionId),
        sessionChanged
      })
    ) {
      void persistSnapshot(snapshot)
      return
    }

    const timer = setTimeout(() => {
      void persistSnapshot(snapshot)
    }, 180)

    return () => clearTimeout(timer)
  }, [
    currentAssistant?.id,
    currentSessionId,
    dbReady,
    persistSnapshot,
    restoreLastSessionOnReturn,
    services,
    vaultSwitching
  ])

  useEffect(() => {
    if (!dbReady || !services || !currentSessionId || vaultSwitching) return

    let cancelled = false
    void (async () => {
      const session = await lookupSession(services, currentSessionId)
      if (cancelled || vaultSwitchingRef.current || !session) return

      const sessionAssistantId = session.assistantId ?? null
      if (
        !sessionAssistantId ||
        !currentAssistant?.id ||
        sessionAssistantId === currentAssistant.id
      ) {
        return
      }

      const assistant = assistants.find((item) => item.id === sessionAssistantId)
      if (assistant) {
        handleSelectAssistant(assistant)
        void loadSessions(true, assistant.id)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    assistants,
    currentAssistant?.id,
    currentSessionId,
    dbReady,
    handleSelectAssistant,
    loadSessions,
    services,
    vaultSwitching
  ])

  const reconcileSessionAssistant = useCallback(async () => {
    if (!hydratedRef.current || !dbReady || !services || vaultSwitching || !restorePrefReady) return

    const vaultKey = hydratedVaultKeyRef.current
    if (!vaultKey) return
    const reconcileKey = `${vaultKey}:${currentAssistant?.id ?? ''}:${currentSessionId ?? ''}`
    const now = Date.now()
    if (
      shouldThrottleNavigationReconcile({
        reconcileKey,
        lastReconcileKey: lastReconcileKeyRef.current,
        lastReconcileAtMs: lastReconcileAtRef.current,
        nowMs: now,
        throttleMs: RECONCILE_THROTTLE_MS
      })
    ) {
      return
    }
    lastReconcileKeyRef.current = reconcileKey
    lastReconcileAtRef.current = now

    if (!restoreLastSessionOnReturn) {
      if (currentSessionId) {
        clearSession()
      }
      return
    }

    const saved = useAgentNavigationStore.getState().getContext(vaultKey)

    if (!currentSessionId) {
      if (!restoreLastSessionOnReturn) return
      if (assistants.length === 0) return

      if (
        shouldSkipSessionRestoreForAssistantMismatch({
          currentAssistantId: currentAssistant?.id,
          savedAssistantId: saved.assistantId
        })
      ) {
        void persistSnapshot({ assistantId: currentAssistant!.id, sessionId: null }, vaultKey)
        return
      }

      await restoreSavedOrRecentSession({ vaultKey, saved })
      return
    }

    const session = await lookupSession(services, currentSessionId)
    if (vaultSwitchingRef.current || hydratedVaultKeyRef.current !== vaultKey) return
    if (!session) {
      invalidateCurrentSession()
      return
    }

    const sessionAssistantId = session.assistantId ?? null
    if (
      !sessionAssistantId ||
      !currentAssistant?.id ||
      sessionAssistantId === currentAssistant.id
    ) {
      return
    }

    const assistant = assistants.find((item) => item.id === sessionAssistantId)
    if (assistant) {
      handleSelectAssistant(assistant)
      void loadSessions(true, assistant.id)
    }
  }, [
    assistants,
    clearSession,
    invalidateCurrentSession,
    currentAssistant,
    currentSessionId,
    dbReady,
    handleSelectAssistant,
    loadSessions,
    persistSnapshot,
    restorePrefReady,
    restoreLastSessionOnReturn,
    restoreSavedOrRecentSession,
    services,
    vaultSwitching
  ])

  useFocusEffect(
    useCallback(() => {
      if (restoringRef.current) return
      void reconcileSessionAssistant()

      return () => {
        if (!hydratedRef.current || !services || vaultSwitchingRef.current) return
        const boundVaultKey = hydratedVaultKeyRef.current
        if (!boundVaultKey) return
        if (
          shouldSkipNavigationPersistBeforeRestore({
            restoreLastSessionOnReturn,
            initialRestoreDone: initialRestoreDoneRef.current,
            currentSessionId: currentSessionIdRef.current
          })
        ) {
          return
        }
        void (async () => {
          await persistSnapshot(
            {
              assistantId: currentAssistantIdRef.current,
              sessionId: restoreLastSessionOnReturn ? currentSessionIdRef.current : null
            },
            boundVaultKey
          )
        })()
      }
    }, [reconcileSessionAssistant, persistSnapshot, restoreLastSessionOnReturn, services])
  )
}
