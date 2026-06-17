import { useEffect, useRef, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useAgentNavigationStore } from '@baishou/store'
import type { MobileAssistantUi } from '../lib/mobile-assistant.util'
import {
  readAgentNavigationSnapshot,
  writeAgentNavigationSnapshot
} from '../lib/agent-navigation-persistence'

type SessionRow = { id: string; assistantId?: string | null }

type Services = {
  pathService: { getActiveVaultNameForContext: () => Promise<string> }
  sessionManager: {
    getSessionById: (sessionId: string) => Promise<SessionRow | null>
  }
}

type UseAgentNavigationPersistenceOptions = {
  dbReady: boolean
  vaultSwitching: boolean
  vaultRevision: number
  services: Services | null
  assistants: MobileAssistantUi[]
  currentAssistant: MobileAssistantUi | null
  currentSessionId: string | null
  handleSelectAssistant: (assistant: MobileAssistantUi) => void
  handleSelectSession: (sessionId: string) => Promise<void>
  loadSessions: (resetOffset?: boolean, overrideAssistantId?: string) => Promise<void>
  clearSession: () => void
}

async function lookupSession(
  sessionManager: Services['sessionManager'],
  sessionId: string
): Promise<SessionRow | null> {
  const session = await sessionManager.getSessionById(sessionId)
  if (!session) return null
  return { id: session.id, assistantId: session.assistantId ?? null }
}

export function useAgentNavigationPersistence({
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
  clearSession
}: UseAgentNavigationPersistenceOptions) {
  const hydratedRef = useRef(false)
  const restoringRef = useRef(false)
  const lastPersistedRef = useRef<string>('')
  const prevSessionIdRef = useRef<string | null>(null)

  const persistSnapshot = useCallback(
    async (snapshot: { assistantId: string | null; sessionId: string | null }) => {
      if (!services) return
      const serialized = JSON.stringify(snapshot)
      if (serialized === lastPersistedRef.current) return
      lastPersistedRef.current = serialized
      const vaultKey = await services.pathService.getActiveVaultNameForContext()
      useAgentNavigationStore.getState().setContext(vaultKey, snapshot)
      await writeAgentNavigationSnapshot(vaultKey, snapshot)
    },
    [services]
  )

  useEffect(() => {
    hydratedRef.current = false
    restoringRef.current = false
    if (!dbReady || !services || vaultSwitching) return

    let cancelled = false
    void (async () => {
      const vaultKey = await services.pathService.getActiveVaultNameForContext()
      const saved = await readAgentNavigationSnapshot(vaultKey)
      if (cancelled) return
      if (saved) {
        useAgentNavigationStore.getState().setContext(vaultKey, saved)
        lastPersistedRef.current = JSON.stringify(saved)
      } else {
        useAgentNavigationStore.getState().clearContext(vaultKey)
        lastPersistedRef.current = ''
      }
      hydratedRef.current = true
    })()

    return () => {
      cancelled = true
      restoringRef.current = false
    }
  }, [dbReady, services, vaultRevision, vaultSwitching])

  useEffect(() => {
    if (!hydratedRef.current || !dbReady || !services || vaultSwitching || restoringRef.current) {
      return
    }
    if (currentSessionId) return
    if (assistants.length === 0) return

    let cancelled = false
    restoringRef.current = true

    void (async () => {
      try {
        const vaultKey = await services.pathService.getActiveVaultNameForContext()
        const saved = useAgentNavigationStore.getState().getContext(vaultKey)
        if (!saved.sessionId && !saved.assistantId) return

        let assistantToUse = currentAssistant
        if (saved.assistantId) {
          const assistant = assistants.find((item) => item.id === saved.assistantId)
          if (assistant && assistant.id !== currentAssistant?.id) {
            handleSelectAssistant(assistant)
            assistantToUse = assistant
          }
        }

        if (saved.sessionId) {
          const session = await lookupSession(services.sessionManager, saved.sessionId)
          if (cancelled) return
          if (!session) {
            clearSession()
            return
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
          return
        }

        if (!currentSessionId) {
          clearSession()
        }
      } finally {
        if (!cancelled) restoringRef.current = false
      }
    })()

    return () => {
      cancelled = true
      restoringRef.current = false
    }
  }, [
    assistants,
    clearSession,
    currentAssistant,
    currentSessionId,
    dbReady,
    handleSelectAssistant,
    handleSelectSession,
    loadSessions,
    services,
    vaultSwitching
  ])

  useEffect(() => {
    if (!hydratedRef.current || !dbReady || !services || vaultSwitching || restoringRef.current) {
      return
    }

    const snapshot = {
      assistantId: currentAssistant?.id ?? null,
      sessionId: currentSessionId
    }

    const prevSessionId = prevSessionIdRef.current
    prevSessionIdRef.current = currentSessionId

    if (prevSessionId && !currentSessionId) {
      void persistSnapshot(snapshot)
      return
    }

    const timer = setTimeout(() => {
      void persistSnapshot(snapshot)
    }, 180)

    return () => clearTimeout(timer)
  }, [currentAssistant?.id, currentSessionId, dbReady, persistSnapshot, services, vaultSwitching])

  useEffect(() => {
    if (!dbReady || !services || !currentSessionId) return

    let cancelled = false
    void (async () => {
      const session = await lookupSession(services.sessionManager, currentSessionId)
      if (cancelled || !session) return

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
    services
  ])

  const reconcileSessionAssistant = useCallback(async () => {
    if (!hydratedRef.current || !dbReady || !services || vaultSwitching) return

    const vaultKey = await services.pathService.getActiveVaultNameForContext()
    const saved = useAgentNavigationStore.getState().getContext(vaultKey)
    let persistedSessionId: string | null | undefined = saved.sessionId
    if (lastPersistedRef.current) {
      try {
        const parsed = JSON.parse(lastPersistedRef.current) as { sessionId?: string | null }
        persistedSessionId = parsed.sessionId ?? null
      } catch {
        // ignore malformed cache
      }
    }

    if (!currentSessionId) {
      if (!saved.sessionId) return
      if (persistedSessionId == null) return
      if (assistants.length === 0) return

      if (saved.assistantId) {
        const assistant = assistants.find((item) => item.id === saved.assistantId)
        if (assistant && assistant.id !== currentAssistant?.id) {
          handleSelectAssistant(assistant)
        }
      }

      const session = await lookupSession(services.sessionManager, saved.sessionId)
      if (!session) {
        clearSession()
        return
      }
      await handleSelectSession(saved.sessionId)
      void loadSessions(true, saved.assistantId ?? currentAssistant?.id ?? undefined)
      return
    }

    const session = await lookupSession(services.sessionManager, currentSessionId)
    if (!session) {
      clearSession()
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
    currentAssistant?.id,
    currentSessionId,
    dbReady,
    handleSelectAssistant,
    handleSelectSession,
    loadSessions,
    services,
    vaultSwitching
  ])

  useFocusEffect(
    useCallback(() => {
      if (restoringRef.current) return
      void reconcileSessionAssistant()
    }, [reconcileSessionAssistant])
  )
}
