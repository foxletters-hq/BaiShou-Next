import { useCallback, useEffect, useRef, useState } from 'react'
import { InteractionManager } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { type GlobalModelsConfig, type RagConfig } from '@baishou/shared'
import { useBaishou } from '../../providers/BaishouProvider'
import {
  hydrateOrganizePendingSnapshot,
  peekOrganizePendingSnapshot,
  subscribeMobilePendingEmbedCountsChanged,
  type OrganizePendingSnapshot
} from '../../services/mobile-pending-embed-counts'
import {
  diaryPendingStatusFromSnapshot,
  initialDiaryPendingStatusFromSnapshot,
  loadDiaryPendingStatus,
  resolveDiaryPendingStatusRefresh,
  shouldHydrateDiaryPendingSnapshot,
  type DiaryOrganizePendingSnapshot,
  type DiaryPendingStatusView
} from './diary-pending-status.util'

function applyDiaryPendingView(
  view: DiaryPendingStatusView,
  setters: {
    setPendingGraphCount: (value: number) => void
    setPendingEmbedCount: (value: number) => void
    setPendingEmbedParts: (value: DiaryPendingStatusView['pendingEmbedParts']) => void
    setGraphConfigured: (value: boolean) => void
    setRagConfigured: (value: boolean) => void
  }
) {
  setters.setPendingGraphCount(view.pendingGraphCount)
  setters.setPendingEmbedCount(view.pendingEmbedCount)
  setters.setPendingEmbedParts(view.pendingEmbedParts)
  setters.setGraphConfigured(view.graphConfigured)
  setters.setRagConfigured(view.ragConfigured)
}

export function useDiaryPendingStatus() {
  const { services, dbReady, vaultRevision, archiveRestoreEpoch } = useBaishou()
  const initial = initialDiaryPendingStatusFromSnapshot(peekOrganizePendingSnapshot())
  const [pendingGraphCount, setPendingGraphCount] = useState(initial.pendingGraphCount)
  const [pendingEmbedCount, setPendingEmbedCount] = useState(initial.pendingEmbedCount)
  const [pendingEmbedParts, setPendingEmbedParts] = useState(initial.pendingEmbedParts)
  const [graphConfigured, setGraphConfigured] = useState(initial.graphConfigured)
  const [ragConfigured, setRagConfigured] = useState(initial.ragConfigured)
  const latestRequestIdRef = useRef(0)
  const liveAppliedRef = useRef(false)
  const statusRef = useRef<DiaryPendingStatusView>(initial)
  statusRef.current = {
    pendingGraphCount,
    pendingEmbedCount,
    pendingEmbedParts,
    graphConfigured,
    ragConfigured
  }

  const applyView = useCallback((view: DiaryPendingStatusView) => {
    applyDiaryPendingView(view, {
      setPendingGraphCount,
      setPendingEmbedCount,
      setPendingEmbedParts,
      setGraphConfigured,
      setRagConfigured
    })
  }, [])

  const refreshStatusBar = useCallback(async () => {
    if (!services || !dbReady) return
    const requestId = ++latestRequestIdRef.current
    try {
      const { view } = await loadDiaryPendingStatus({
        getSnapshot: () =>
          (
            services.ragService as {
              getOrganizePendingSnapshot?: () => Promise<OrganizePendingSnapshot>
            }
          ).getOrganizePendingSnapshot?.() ?? Promise.resolve(peekOrganizePendingSnapshot()),
        getRagConfig: () => services.settingsManager.get<RagConfig>('rag_config'),
        getGlobalModels: () => services.settingsManager.get<GlobalModelsConfig>('global_models'),
        fallbackSnapshot: peekOrganizePendingSnapshot()
      })
      const applied = resolveDiaryPendingStatusRefresh({
        requestId,
        latestRequestId: latestRequestIdRef.current,
        previous: statusRef.current,
        next: view,
        failed: false
      })
      if (!applied) return
      liveAppliedRef.current = true
      applyView(applied)
    } catch {
      const applied = resolveDiaryPendingStatusRefresh({
        requestId,
        latestRequestId: latestRequestIdRef.current,
        previous: statusRef.current,
        next: null,
        failed: true
      })
      if (applied) applyView(applied)
    }
  }, [applyView, dbReady, services])

  useEffect(() => {
    void hydrateOrganizePendingSnapshot().then((snap) => {
      if (!snap) return
      if (
        !shouldHydrateDiaryPendingSnapshot({
          liveApplied: liveAppliedRef.current,
          current: statusRef.current
        })
      ) {
        return
      }
      const view = diaryPendingStatusFromSnapshot(snap as DiaryOrganizePendingSnapshot, true)
      if (view) applyView(view)
    })
  }, [applyView])

  useEffect(() => {
    return subscribeMobilePendingEmbedCountsChanged(() => {
      void refreshStatusBar()
    })
  }, [refreshStatusBar])

  useEffect(() => {
    if (!dbReady || (vaultRevision === 0 && archiveRestoreEpoch === 0)) return
    void refreshStatusBar()
  }, [archiveRestoreEpoch, dbReady, refreshStatusBar, vaultRevision])

  const firstFocusRef = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false
        const handle = InteractionManager.runAfterInteractions(() => {
          void refreshStatusBar()
        })
        return () => handle.cancel()
      }
      void refreshStatusBar()
    }, [refreshStatusBar])
  )

  return {
    pendingGraphCount,
    pendingEmbedCount,
    pendingEmbedParts,
    graphConfigured,
    ragConfigured
  }
}
