import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusEffect } from '@react-navigation/native'
import {
  EMPTY_PENDING_EMBED_COUNTS,
  buildMemoryOnboardingModel,
  buildMemoryReadinessRows,
  deriveLegacyVaultId,
  hasGraphModelConfigured,
  isEmbeddingConfiguredForMemory,
  shouldShowMemoryOnboarding,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type PendingEmbedCounts,
  type RagConfig
} from '@baishou/shared'
import { getDefaultGlobalModels } from '@baishou/store'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { mobileListPendingReextract } from '@/src/services/mobile-graph.service'
import {
  hydrateOrganizePendingSnapshot,
  peekOrganizePendingSnapshot
} from '@/src/services/mobile-pending-embed-counts'
import {
  readMemoryOnboardingDismissed,
  writeMemoryOnboardingDismissed
} from './memory-center-onboarding.storage'
import { normalizeMemoryCenterRagConfig, readActiveVaultSafely } from './memory-center-data.util'
import {
  immediateOrganizePendingSnapshot,
  loadMemoryOrganizePending
} from './memory-center-organize.util'
import { getBatchEmbedInFlight } from '@/src/services/mobile-rag-state.helpers'
import {
  getCachedMobileRagState,
  patchCachedMobileRagState
} from '@/src/services/mobile-rag-runtime-cache'
import { readMemoryOrganizeInterrupted } from './memory-center-organize.storage'

export type MemoryPendingPartCounts = PendingEmbedCounts & {
  graphExtract?: number
  graphDisambiguate?: number
}

export type MemoryOrganizeRefreshSnapshot = {
  embeddingConfigured: boolean
  extractConfigured: boolean
  pendingEmbedCount: number
  pendingGraphCount: number
  livePending: MemoryPendingPartCounts
  providers: AIProviderConfig[]
}

/**
 * 记忆中心的数据读取与订阅：模型、RAG 开关、待整理计数和引导状态。
 * 只负责「读」，整理动作与模型切换放在 useMemoryCenterOrganize。
 */
export function useMemoryCenterData() {
  const { t } = useTranslation()
  const { dbReady, services, vaultRevision, archiveRestoreEpoch } = useBaishou()
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [pendingEmbedParts, setPendingEmbedParts] = useState<MemoryPendingPartCounts>(
    () =>
      immediateOrganizePendingSnapshot(peekOrganizePendingSnapshot()) ?? EMPTY_PENDING_EMBED_COUNTS
  )
  const [pendingGraphCount, setPendingGraphCount] = useState(
    () => immediateOrganizePendingSnapshot(peekOrganizePendingSnapshot())?.graphExtract ?? 0
  )
  const [globalModels, setGlobalModels] = useState<GlobalModelsConfig | null>(null)
  const [ragConfig, setRagConfig] = useState<Pick<RagConfig, 'ragEnabled'> | null>(null)
  const [onboardingDismissed, setOnboardingDismissed] = useState(true)
  const [organizeSnapshotReady, setOrganizeSnapshotReady] = useState(() =>
    Boolean(immediateOrganizePendingSnapshot(peekOrganizePendingSnapshot()))
  )
  const refreshInFlight = useRef<Promise<MemoryOrganizeRefreshSnapshot | null> | null>(null)
  const pendingAppliedFromNetwork = useRef(false)

  const refresh = useCallback(async (): Promise<MemoryOrganizeRefreshSnapshot | null> => {
    if (refreshInFlight.current) return refreshInFlight.current
    const applyLivePending = (embedCounts: MemoryPendingPartCounts | null): number | undefined => {
      const nextPending = embedCounts ?? EMPTY_PENDING_EMBED_COUNTS
      setPendingEmbedParts(nextPending)
      const snapshotExtract =
        embedCounts && 'graphExtract' in embedCounts ? embedCounts.graphExtract : undefined
      if (typeof snapshotExtract === 'number') {
        setPendingGraphCount(snapshotExtract)
        setOrganizeSnapshotReady(true)
        return snapshotExtract
      }
      return undefined
    }
    const task = (async (): Promise<MemoryOrganizeRefreshSnapshot | null> => {
      if (!dbReady || !services) return null
      const pendingPromise = loadMemoryOrganizePending(services.ragService)
      void pendingPromise.then((embedCounts) => {
        pendingAppliedFromNetwork.current = true
        applyLivePending(embedCounts)
      })
      const [models, rag, dismissed, providerList] = await Promise.all([
        services.settingsManager.get<GlobalModelsConfig>('global_models'),
        services.settingsManager.get<{ ragEnabled?: boolean }>('rag_config'),
        readMemoryOnboardingDismissed(),
        services.settingsManager.get<AIProviderConfig[]>('ai_providers'),
        readMemoryOrganizeInterrupted()
      ])
      const embedCounts = await pendingPromise
      const nextModels = models ? { ...getDefaultGlobalModels(), ...models } : null
      const nextProviders = Array.isArray(providerList) ? providerList : []
      const nextPending = embedCounts ?? EMPTY_PENDING_EMBED_COUNTS
      setGlobalModels(nextModels)
      setRagConfig(normalizeMemoryCenterRagConfig(rag))
      setOnboardingDismissed(dismissed)
      setProviders(nextProviders)

      let nextGraphCount = applyLivePending(embedCounts)
      if (typeof nextGraphCount !== 'number') {
        const activeVault = readActiveVaultSafely(services.vaultService)
        const vaultName = activeVault?.name || 'Personal'
        const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)
        try {
          const pending = await mobileListPendingReextract({
            vaultName,
            vaultId,
            shadowRepo: new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId),
            pathService: services.pathService,
            fileSystem: services.fileSystem
          })
          nextGraphCount = pending.length
        } catch {
          nextGraphCount = 0
        }
        setPendingEmbedParts(nextPending)
        setPendingGraphCount(nextGraphCount)
        setOrganizeSnapshotReady(true)
      }
      return {
        embeddingConfigured: isEmbeddingConfiguredForMemory(nextModels),
        extractConfigured: hasGraphModelConfigured(nextModels),
        pendingEmbedCount: nextPending.total,
        pendingGraphCount: nextGraphCount,
        livePending: nextPending,
        providers: nextProviders
      }
    })()
    refreshInFlight.current = task
    try {
      return await task
    } finally {
      if (refreshInFlight.current === task) refreshInFlight.current = null
    }
  }, [dbReady, services])

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh])
  )

  useEffect(() => {
    if (!dbReady || (vaultRevision === 0 && archiveRestoreEpoch === 0)) return
    void refresh()
  }, [archiveRestoreEpoch, dbReady, refresh, vaultRevision])

  useEffect(() => {
    void hydrateOrganizePendingSnapshot().then((snap) => {
      if (!snap || pendingAppliedFromNetwork.current) return
      if (!immediateOrganizePendingSnapshot(snap)) return
      setPendingEmbedParts(snap)
      setPendingGraphCount(snap.graphExtract)
      setOrganizeSnapshotReady(true)
    })
  }, [])

  useEffect(() => {
    if (!getBatchEmbedInFlight()) return
    const current = getCachedMobileRagState()
    if (current.isRunning && current.type === 'batchEmbed') return
    patchCachedMobileRagState({
      isRunning: true,
      type: 'batchEmbed',
      statusText: t('memory.readiness_organizing', '正在整理记忆…')
    })
  }, [t])

  const pendingEmbedCount = pendingEmbedParts.total
  const embeddingConfigured = isEmbeddingConfiguredForMemory(globalModels)
  const rows = useMemo(
    () =>
      buildMemoryReadinessRows({
        globalModels,
        ragConfig,
        pendingEmbedCount,
        pendingGraphCount
      }),
    [globalModels, ragConfig, pendingEmbedCount, pendingGraphCount]
  )
  const showOnboarding = shouldShowMemoryOnboarding({
    dismissed: onboardingDismissed,
    embeddingConfigured,
    pendingEmbedCount,
    pendingGraphCount
  })
  const onboarding = useMemo(
    () =>
      buildMemoryOnboardingModel({
        embeddingConfigured,
        pendingEmbedCount,
        pendingGraphCount
      }),
    [embeddingConfigured, pendingEmbedCount, pendingGraphCount]
  )

  const dismissOnboarding = useCallback(() => {
    void writeMemoryOnboardingDismissed().then(() => setOnboardingDismissed(true))
  }, [])

  return {
    dbReady,
    providers,
    globalModels,
    rows,
    showOnboarding,
    onboarding,
    pendingEmbedParts,
    pendingGraphCount,
    pendingEmbedCount,
    organizeSnapshotReady,
    refresh,
    setGlobalModels,
    setProviders,
    dismissOnboarding
  }
}
