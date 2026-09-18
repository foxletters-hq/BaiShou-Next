import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  deriveLegacyVaultId,
  EMPTY_PENDING_EMBED_COUNTS,
  isStartupEmbedReminderEnabled,
  shouldShowPendingEmbedReminder,
  type PendingEmbedCounts
} from '@baishou/shared'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { mobileListPendingReextract } from '../../services/mobile-graph.service'
import {
  isRagEmbedFeatureConfigured,
  type GlobalModelsConfig,
  type RagConfig
} from '@baishou/shared'
import { useBaishou } from '../../providers/BaishouProvider'

export function useDiaryPendingStatus() {
  const { services, dbReady } = useBaishou()
  const [pendingGraphCount, setPendingGraphCount] = useState(0)
  const [pendingEmbedCount, setPendingEmbedCount] = useState(0)
  const [pendingEmbedParts, setPendingEmbedParts] = useState<PendingEmbedCounts>(
    EMPTY_PENDING_EMBED_COUNTS
  )
  const [graphConfigured, setGraphConfigured] = useState(false)
  const [ragConfigured, setRagConfigured] = useState(false)
  const [pendingNotice, setPendingNotice] = useState<{ count: number; needModel: boolean } | null>(
    null
  )

  const refreshStatusBar = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const activeVault = services.vaultService.getActiveVault()
      const vaultName = activeVault?.name || 'Personal'
      const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)
      const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId)
      const [pending, embedCount, globalModels, ragConfig] = await Promise.all([
        mobileListPendingReextract({
          vaultName,
          vaultId,
          shadowRepo,
          pathService: services.pathService,
          fileSystem: services.fileSystem
        }),
        (services.ragService as { getPendingEmbedCounts?: () => Promise<PendingEmbedCounts> })
          .getPendingEmbedCounts?.()
          .catch(() => EMPTY_PENDING_EMBED_COUNTS) ?? Promise.resolve(EMPTY_PENDING_EMBED_COUNTS),
        services.settingsManager.get<GlobalModelsConfig>('global_models'),
        services.settingsManager.get<RagConfig>('rag_config')
      ])
      const counts =
        embedCount && typeof embedCount === 'object' && 'total' in embedCount
          ? embedCount
          : EMPTY_PENDING_EMBED_COUNTS
      setPendingGraphCount(pending.length)
      setPendingEmbedCount(counts.total)
      setPendingEmbedParts(counts)
      setGraphConfigured(true)
      const embeddingReady = isRagEmbedFeatureConfigured({
        ragConfig,
        globalModels
      })
      setRagConfigured(embeddingReady)
      if (
        shouldShowPendingEmbedReminder(counts.total, {
          enabled: isStartupEmbedReminderEnabled(ragConfig)
        })
      ) {
        setPendingNotice({ count: counts.total, needModel: !embeddingReady })
      }
    } catch {
      setPendingGraphCount(0)
      setPendingEmbedCount(0)
      setPendingEmbedParts(EMPTY_PENDING_EMBED_COUNTS)
      setGraphConfigured(false)
      setRagConfigured(false)
    }
  }, [dbReady, services])

  useFocusEffect(
    useCallback(() => {
      void refreshStatusBar()
    }, [refreshStatusBar])
  )

  return {
    pendingGraphCount,
    pendingEmbedCount,
    pendingEmbedParts,
    graphConfigured,
    ragConfigured,
    pendingNotice,
    setPendingNotice
  }
}
