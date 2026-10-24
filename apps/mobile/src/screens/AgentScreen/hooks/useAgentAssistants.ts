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
    vaultRevision,
    ecosystemResyncEpoch,
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
  const lastVaultRevisionRef = useRef(vaultRevision)
  const lastEcosystemResyncEpochRef = useRef(ecosystemResyncEpoch)

  useEffect(() => {
    if (vaultSwitching) {
      loadAssistantsRequestRef.current += 1
      setAssistants([])
    }
  }, [vaultSwitching])

  const loadAssistants = useCallback(async () => {
    if (!dbReady || !services || vaultSwitching) return
    if (storageIndexing) {
      await waitForVaultEcosystemResync()
    }
    const requestId = ++loadAssistantsRequestRef.current
    try {
      const rows = await services.assistantManager.findAll()
      if (requestId !== loadAssistantsRequestRef.current) return
      // 先用库里的元数据铺满列表，头像解析失败也不该让伙伴列表变空
      setAssistants(mapAssistantRowsToUiWithCachedAvatars(rows, { preferFileUri: true }))
      if (rows.length === 0) return

      const hydrated = await hydrateAssistantsForUi(
        rows,
        services.attachmentManager,
        services.fileSystem,
        { preferFileUri: true }
      )
      if (requestId !== loadAssistantsRequestRef.current) return
      setAssistants(hydrated)
    } catch (e) {
      if (requestId !== loadAssistantsRequestRef.current) return
      // 保留上一次成功加载的列表，避免临时读盘/头像失败把伙伴选择器打成空态
      console.warn('Failed to load assistants', e)
    }
  }, [dbReady, services, storageIndexing, vaultSwitching])

  const refreshAssistantsOnFocus = useCallback(() => {
    void loadAssistants()
  }, [loadAssistants])

  useEffect(() => {
    void loadAssistants()
  }, [loadAssistants])

  // 归档恢复 / 迁移 / 工作区切换完成后，伙伴 JSON 与影子库都可能已更新；
  // 与 useAgentSessions 保持一致，跟着 revision/epoch 重新加载，避免只有设置页能看到伙伴。
  useEffect(() => {
    const vaultChanged = lastVaultRevisionRef.current !== vaultRevision
    const ecosystemResynced = lastEcosystemResyncEpochRef.current !== ecosystemResyncEpoch
    lastVaultRevisionRef.current = vaultRevision
    lastEcosystemResyncEpochRef.current = ecosystemResyncEpoch

    if (!vaultChanged && !ecosystemResynced) return
    void loadAssistants()
  }, [vaultRevision, ecosystemResyncEpoch, loadAssistants])

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
      const full = assistants.find((a) => a.id === assistant.id) ?? assistant
      if (!full?.id) return

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
