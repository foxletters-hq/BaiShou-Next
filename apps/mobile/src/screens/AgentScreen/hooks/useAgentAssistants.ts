import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAgentNavigationStore } from '@baishou/store'
import type { MockAgentAssistant } from '@baishou/ui/native'
import type { AssistantSummary } from '../../../components/AgentDrawer'
import {
  hydrateAssistantsForUi,
  mapAssistantRowsToUiWithCachedAvatars,
  type MobileAssistantUi
} from '../../../lib/mobile-assistant.util'
import { writeAgentNavigationSnapshot } from '../../../lib/agent-navigation-persistence'
import { consumeAssistantsNeedRefresh } from '../../../lib/assistant-ui-refresh-signal'
import { waitForVaultEcosystemResync } from '../../../services/mobile-vault-resync.service'
import { useThrottledFocusRefresh } from '../../../hooks/useThrottledFocusRefresh'
import type { useBaishou } from '../../../providers/BaishouProvider'
import type { useAgentModel } from '../../../hooks/useAgentModel'
import type { useAgentSession } from '../../../hooks/useAgentSession'
import type { useAgentSessions } from '../../../hooks/useAgentSessions'

type Baishou = ReturnType<typeof useBaishou>
type Model = ReturnType<typeof useAgentModel>
type Session = ReturnType<typeof useAgentSession>
type Sessions = ReturnType<typeof useAgentSessions>

export function useAgentAssistants(deps: {
  dbReady: boolean
  services: Baishou['services']
  storageIndexing: boolean
  vaultRevision: number
  ecosystemResyncEpoch: number
  vaultSwitching: boolean
  currentAssistant: Model['currentAssistant']
  setCurrentAssistant: Model['setCurrentAssistant']
  handleSelectAssistant: Model['handleSelectAssistant']
  handleAssistantSwitched: Session['handleAssistantSwitched']
  handleSelectSession: Session['handleSelectSession']
  loadSessions: Sessions['loadSessions']
}) {
  const {
    dbReady,
    services,
    storageIndexing,
    vaultRevision: _vaultRevision,
    ecosystemResyncEpoch: _ecosystemResyncEpoch,
    vaultSwitching,
    currentAssistant,
    setCurrentAssistant,
    handleSelectAssistant,
    handleAssistantSwitched,
    handleSelectSession,
    loadSessions
  } = deps

  const [assistants, setAssistants] = useState<MobileAssistantUi[]>([])
  const loadAssistantsRequestRef = useRef(0)

  useEffect(() => {
    if (vaultSwitching) {
      loadAssistantsRequestRef.current += 1
      setAssistants([])
    }
  }, [vaultSwitching])

  const loadAssistants = useCallback(async () => {
    if (!dbReady || !services) return
    if (storageIndexing) {
      await waitForVaultEcosystemResync()
    }
    const requestId = ++loadAssistantsRequestRef.current
    try {
      const rows = await services.assistantManager.findAll()
      if (requestId !== loadAssistantsRequestRef.current) return
      setAssistants(mapAssistantRowsToUiWithCachedAvatars(rows, { preferFileUri: true }))

      const hydrated = await hydrateAssistantsForUi(
        rows,
        services.attachmentManager,
        services.fileSystem,
        { preferFileUri: true }
      )
      if (requestId !== loadAssistantsRequestRef.current) return
      setAssistants(hydrated)
    } catch {
      if (requestId !== loadAssistantsRequestRef.current) return
      setAssistants([])
    }
  }, [dbReady, services, storageIndexing])

  const refreshAssistantsOnFocus = useCallback(() => {
    void loadAssistants()
  }, [loadAssistants])

  useEffect(() => {
    void loadAssistants()
  }, [loadAssistants])

  useThrottledFocusRefresh(refreshAssistantsOnFocus, 2000, consumeAssistantsNeedRefresh)

  // 伙伴头像/名称变更后同步 currentAssistant，避免聊天界面仍展示旧数据
  useEffect(() => {
    if (!currentAssistant?.id) return
    const updated = assistants.find((a) => a.id === currentAssistant.id)
    if (!updated) return
    if (
      updated.avatarPath !== currentAssistant.avatarPath ||
      updated.displayAvatarUri !== currentAssistant.displayAvatarUri ||
      updated.name !== currentAssistant.name ||
      updated.emoji !== currentAssistant.emoji
    ) {
      setCurrentAssistant(updated)
    }
  }, [assistants, currentAssistant, setCurrentAssistant])

  const pinnedAssistants = useMemo(
    () =>
      assistants
        .filter((a) => a.isPinned)
        .slice(0, 3)
        .map(({ id, name, description, emoji, avatarPath, displayAvatarUri, assistantKind }) => ({
          id,
          name,
          description,
          emoji,
          avatarPath,
          displayAvatarUri,
          assistantKind
        })),
    [assistants]
  )

  const pickerAssistants = useMemo<MockAgentAssistant[]>(
    () =>
      assistants.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description || '',
        emoji: a.emoji,
        avatarPath: a.avatarPath,
        displayAvatarUri: a.displayAvatarUri,
        systemPrompt: a.systemPrompt,
        providerId: a.providerId,
        modelId: a.modelId,
        assistantKind: a.assistantKind,
        contextWindow: a.contextWindow,
        compressTokenThreshold: a.compressTokenThreshold,
        compressKeepTurns: a.compressKeepTurns,
        compressSystemPrompt: a.compressSystemPrompt
      })),
    [assistants]
  )

  const handleSelectAssistantWithTracking = useCallback(
    async (assistant: AssistantSummary) => {
      const full = assistants.find((a) => a.id === assistant.id)
      if (!full) return

      if (dbReady && services) {
        try {
          const vaultKey = await services.pathService.getActiveVaultNameForContext()
          const snapshot = { assistantId: assistant.id, sessionId: null }
          useAgentNavigationStore.getState().setContext(vaultKey, snapshot)
          await writeAgentNavigationSnapshot(vaultKey, snapshot)
        } catch (e) {
          console.warn('Failed to persist assistant navigation snapshot', e)
        }
      }

      handleSelectAssistant(full as any)
      const fullWithModel = full as {
        providerId?: string
        modelId?: string
      }
      await handleAssistantSwitched(assistant.id, fullWithModel.providerId, fullWithModel.modelId)

      if (dbReady && services) {
        try {
          const [recentSessions] = await Promise.all([
            services.sessionManager.list(1, 0, assistant.id),
            loadSessions(true, assistant.id)
          ])
          if (recentSessions?.length > 0) {
            await handleSelectSession(recentSessions[0]!.id)
          }
        } catch (e) {
          console.warn('Failed to open recent session for assistant', e)
        }
      }

      void loadAssistants()
    },
    [
      assistants,
      handleSelectAssistant,
      handleAssistantSwitched,
      handleSelectSession,
      services,
      dbReady,
      loadSessions,
      loadAssistants
    ]
  )
  return {
    assistants,
    pinnedAssistants,
    pickerAssistants,
    handleSelectAssistantWithTracking,
    loadAssistants
  }
}
