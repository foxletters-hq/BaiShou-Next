import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  buildMemoryOnboardingModel,
  buildMemoryReadinessRows,
  deriveLegacyVaultId,
  EMPTY_PENDING_EMBED_COUNTS,
  isEmbeddingConfiguredForMemory,
  ragBatchEmbedPhaseLabelKey,
  resolveMemoryOrganizeAction,
  shouldShowMemoryOnboarding,
  type AIProviderConfig,
  type MemoryCenterTab,
  type PendingEmbedCounts,
  type RagBatchEmbedPhaseId,
  type RagConfig
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Card,
  SegmentedControl,
  SettingsCardDivider,
  SettingsGroupCard,
  useDialog,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { RAGMemorySection } from '../SettingsScreen/components/RAGMemorySection'
import { mobileListPendingReextract } from '@/src/services/mobile-graph.service'
import { mobileGraphExtractQueue } from '@/src/services/mobile-graph-extract-queue.service'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import { subscribeMobilePendingEmbedCountsChanged } from '@/src/services/mobile-pending-embed-counts'
import {
  readMemoryOnboardingDismissed,
  writeMemoryOnboardingDismissed
} from './memory-center-onboarding.storage'
import {
  normalizeMemoryCenterRagConfig,
  readActiveVaultSafely,
  resolveMemoryCenterTabParam
} from './memory-center-data.util'
import { useMobileSuspectCount } from '@/src/hooks/useMobileSuspectCount'
import { requestGraphPendingFocus } from '../GraphScreen/graph-pending-focus'
import { requestAiModelsEmbeddingFocus } from '../SettingsScreen/ai-models-embedding-focus'
import { loadMemoryOrganizePending, snapshotMemoryEmbedPhases } from './memory-center-organize.util'
import { ensureMobileGraphSelfName } from '../DiaryScreen/ensure-graph-self-name'
import {
  getCachedMobileRagState,
  patchCachedMobileRagState,
  subscribeMobileRagRuntime
} from '@/src/services/mobile-rag-runtime-cache'
import { MemoryOrganizeModal } from './MemoryOrganizeModal'
import { MemoryReadinessConfigModal } from './MemoryReadinessConfigModal'
import { MemoryReadinessStatusCard } from './MemoryReadinessStatusCard'

export function MemoryCenterScreen() {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const toast = useNativeToast()
  const dialog = useDialog()
  const ragState = useSyncExternalStore(
    subscribeMobileRagRuntime,
    getCachedMobileRagState,
    getCachedMobileRagState
  )
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const chrome = getStackScreenChrome(colors)
  const { dbReady, services } = useBaishou()
  const params = useLocalSearchParams<{ tab?: string | string[] }>()
  const tabParam = resolveMemoryCenterTabParam(params.tab)
  const [tab, setTab] = useState<MemoryCenterTab>(tabParam ?? 'vectors')
  const [configOpen, setConfigOpen] = useState(false)
  const [detectBusy, setDetectBusy] = useState(false)
  const [vectorMeta, setVectorMeta] = useState({ count: 0, dimension: 0 })
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [pendingEmbedParts, setPendingEmbedParts] = useState<
    PendingEmbedCounts & { graphExtract?: number; graphDisambiguate?: number }
  >(EMPTY_PENDING_EMBED_COUNTS)
  const [pendingGraphCount, setPendingGraphCount] = useState(0)
  const [globalModels, setGlobalModels] = useState<Record<string, unknown> | null>(null)
  const [ragConfig, setRagConfig] = useState<Pick<RagConfig, 'ragEnabled'> | null>(null)
  const [onboardingDismissed, setOnboardingDismissed] = useState(true)
  const [busy, setBusy] = useState(false)
  const { suspectCount } = useMobileSuspectCount()

  useEffect(() => {
    if (!tabParam) return
    setTab((prev) => (prev === tabParam ? prev : tabParam))
  }, [tabParam])

  const refresh = useCallback(async () => {
    if (!dbReady || !services) return
    const [models, rag, dismissed, embedCounts, providerList] = await Promise.all([
      services.settingsManager.get<Record<string, unknown>>('global_models'),
      services.settingsManager.get<{ ragEnabled?: boolean }>('rag_config'),
      readMemoryOnboardingDismissed(),
      loadMemoryOrganizePending(services.ragService),
      services.settingsManager.get<AIProviderConfig[]>('ai_providers')
    ])
    setGlobalModels(models ?? null)
    setRagConfig(normalizeMemoryCenterRagConfig(rag))
    setOnboardingDismissed(dismissed)
    setPendingEmbedParts(embedCounts ?? EMPTY_PENDING_EMBED_COUNTS)
    setProviders(Array.isArray(providerList) ? providerList : [])
    try {
      const ragStats = await services.ragService.getStats()
      setVectorMeta({
        count: ragStats.diaryCountForVault ?? ragStats.totalCount,
        dimension: ragStats.currentDimension
      })
    } catch {
      setVectorMeta({ count: 0, dimension: 0 })
    }

    const snapshotExtract =
      embedCounts && 'graphExtract' in embedCounts ? embedCounts.graphExtract : undefined
    if (typeof snapshotExtract === 'number') {
      setPendingGraphCount(snapshotExtract)
      return
    }

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
      setPendingGraphCount(pending.length)
    } catch {
      setPendingGraphCount(0)
    }
  }, [dbReady, services])

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh])
  )

  useEffect(() => {
    return subscribeMobilePendingEmbedCountsChanged(() => {
      void refresh()
    })
  }, [refresh])

  const pendingEmbedCount = pendingEmbedParts.total
  const embeddingConfigured = isEmbeddingConfiguredForMemory(globalModels)
  const embedSnapshot = useMemo(
    () => snapshotMemoryEmbedPhases(pendingEmbedParts, pendingGraphCount),
    [pendingEmbedParts, pendingGraphCount]
  )
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

  const selectTab = (next: MemoryCenterTab) => {
    if (next === tab) return
    setTab(next)
    router.setParams({ tab: next })
  }

  const openGlobalModels = (promptEmbedding: boolean) => {
    setConfigOpen(false)
    if (promptEmbedding) requestAiModelsEmbeddingFocus()
    router.push('/settings/ai-models')
  }

  const handleDetectDimension = async () => {
    if (!services?.ragService) return
    if (!embeddingConfigured) {
      openGlobalModels(true)
      return
    }
    setDetectBusy(true)
    try {
      const dimension = await services.ragService.detectDimension()
      toast.showSuccess(
        t('settings.rag.detect_success', '检测成功：${dimension}维').replace(
          '${dimension}',
          String(dimension)
        )
      )
      await refresh()
    } catch (error) {
      toast.showError(
        error instanceof Error
          ? error.message
          : t('settings.rag.detect_failed', '检测失败，请检查模型配置')
      )
    } finally {
      setDetectBusy(false)
    }
  }

  const startOrganize = async () => {
    if (!services) return
    const action = resolveMemoryOrganizeAction({
      embeddingConfigured,
      pendingEmbedCount
    })
    if (action === 'configure') {
      openGlobalModels(true)
      return
    }
    if (pendingGraphCount > 0) {
      const selfName = await ensureMobileGraphSelfName({
        settingsManager: services.settingsManager
      })
      if (!selfName) {
        toast.showInfo(t('memory.need_self_name', '先在关系图谱里填写自己的名字，再整理记忆'))
        router.push('/graph')
        return
      }
    }
    // graph 与 embed-then-graph 都走 batchEmbed；日记为 0 时 fill 仍会抽图与补向量
    const runtime = getAgentDbRuntime()
    if (runtime?.drizzleDb) {
      const activeVault = readActiveVaultSafely(services.vaultService)
      const vaultName = activeVault?.name || 'Personal'
      const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)
      mobileGraphExtractQueue.setContext({
        vaultId,
        vaultName,
        drizzleDb: runtime.drizzleDb,
        shadowRepo: new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId),
        pathService: services.pathService,
        fileSystem: services.fileSystem,
        settingsManager: services.settingsManager
      })
    }
    setOrganizeOpen(true)
    setBusy(true)
    try {
      const snapshot = snapshotMemoryEmbedPhases(pendingEmbedParts, pendingGraphCount)
      const phaseKey =
        snapshot.phase === 'starting' || snapshot.phase === 'finishing'
          ? 'memory.readiness_organizing'
          : ragBatchEmbedPhaseLabelKey(snapshot.phase as RagBatchEmbedPhaseId)
      toast.showInfo(
        t(phaseKey, t('memory.readiness_organizing', '正在整理记忆…'), {
          count: snapshot.total
        })
      )
      await (
        services.ragService as {
          batchEmbed?: () => Promise<number>
        }
      ).batchEmbed?.()
      await refresh()
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const readinessStatus = (
    <MemoryReadinessStatusCard
      rows={rows}
      providers={providers}
      vectorCount={vectorMeta.count}
      dimension={vectorMeta.dimension}
      organizingLine={
        pendingEmbedCount > 0
          ? `${t(
              embedSnapshot.phase === 'starting' || embedSnapshot.phase === 'finishing'
                ? 'memory.readiness_organizing'
                : ragBatchEmbedPhaseLabelKey(embedSnapshot.phase as RagBatchEmbedPhaseId),
              t('memory.readiness_organizing', '正在整理记忆…')
            )} · ${embedSnapshot.total}`
          : undefined
      }
      onPress={() => setConfigOpen(true)}
    />
  )

  const onboardingCard = showOnboarding ? (
    <Card style={{ marginBottom: tokens.spacing.sm }}>
      <Text style={[styles.onboardingTitle, { color: colors.textPrimary }]}>
        {t('memory.onboarding_title', '开始整理记忆')}
      </Text>
      {onboarding.steps.map((step) => (
        <Text key={step.id} style={{ color: colors.textSecondary, marginTop: tokens.spacing.xs }}>
          {step.id === 'embed'
            ? t('memory.onboarding_step_embed', '配置嵌入模型')
            : step.id === 'vector'
              ? t('memory.onboarding_step_vector', '索引向量片段')
              : t('memory.onboarding_step_graph', '整理关系图谱')}
          {step.count != null ? ` · ${step.count}` : ''}
        </Text>
      ))}
      <View
        style={[styles.onboardingActions, { gap: tokens.spacing.sm, marginTop: tokens.spacing.md }]}
      >
        <Button
          onPress={() => {
            if (onboarding.primaryKind === 'configure') openGlobalModels(true)
            else void startOrganize()
          }}
        >
          {onboarding.primaryKind === 'configure'
            ? t('memory.go_configure', '去配置')
            : t('memory.onboarding_start', '开始整理记忆')}
        </Button>
        <Button
          variant="outlined"
          onPress={() => {
            void writeMemoryOnboardingDismissed().then(() => setOnboardingDismissed(true))
          }}
        >
          {t('memory.onboarding_dismiss', '以后再说')}
        </Button>
      </View>
    </Card>
  ) : null

  return (
    <StackScreenLayout
      title={t('memory.title', '全局 AI 记忆')}
      {...chrome}
      onBack={() => router.back()}
    >
      {!dbReady ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View
            style={[
              styles.head,
              {
                paddingBottom: tokens.spacing.sm,
                paddingHorizontal: tokens.spacing.md,
                paddingTop: tokens.spacing.sm
              }
            ]}
          >
            <SegmentedControl
              value={tab}
              onChange={selectTab}
              accessibilityLabel={t('memory.tabs', '记忆类型')}
              options={[
                { value: 'vectors', label: t('memory.tab_vectors', '向量') },
                { value: 'graph', label: t('memory.tab_graph', '图谱') }
              ]}
            />
          </View>
          {tab === 'vectors' ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: tokens.spacing.md,
                paddingBottom: insets.bottom + tokens.spacing.lg
              }}
              keyboardShouldPersistTaps="handled"
            >
              {onboardingCard}
              <RAGMemorySection hideStats cardLead={readinessStatus} />
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: tokens.spacing.md,
                paddingBottom: insets.bottom + tokens.spacing.lg
              }}
              keyboardShouldPersistTaps="handled"
            >
              {onboardingCard}
              <SettingsGroupCard>
                {readinessStatus}
                <SettingsCardDivider />
                <Text style={{ color: colors.textSecondary }}>
                  {t('graph.pending_entries_hint', '有 {{count}} 篇日记还没整理', {
                    count: pendingGraphCount
                  })}
                </Text>
                <View
                  style={[
                    styles.onboardingActions,
                    { gap: tokens.spacing.sm, marginTop: tokens.spacing.md }
                  ]}
                >
                  <Button onPress={() => void startOrganize()} isDisabled={busy}>
                    {t('memory.start_organize', '开始整理记忆')}
                  </Button>
                  {suspectCount > 0 ? (
                    <Button
                      variant="outlined"
                      onPress={() => {
                        requestGraphPendingFocus()
                        router.push('/graph')
                      }}
                    >
                      {t('memory.review_suspects', '去检查')}
                    </Button>
                  ) : null}
                  <Button variant="outlined" onPress={() => router.push('/graph')}>
                    {t('nav.graph', '关系图谱')}
                  </Button>
                </View>
              </SettingsGroupCard>
            </ScrollView>
          )}
        </View>
      )}
      <MemoryReadinessConfigModal
        visible={configOpen}
        rows={rows}
        providers={providers}
        vectorCount={vectorMeta.count}
        dimension={vectorMeta.dimension}
        detectBusy={detectBusy}
        onClose={() => setConfigOpen(false)}
        onConfigureModels={() => openGlobalModels(false)}
        onDetectDimension={() => void handleDetectDimension()}
      />
      <MemoryOrganizeModal
        visible={organizeOpen}
        ragState={ragState}
        onClose={() => setOrganizeOpen(false)}
        onPause={() => {
          services?.ragService.requestOperationPause()
          patchCachedMobileRagState({ paused: true, cancelling: false, isRunning: true })
        }}
        onResume={() => {
          services?.ragService.requestOperationResume()
          patchCachedMobileRagState({ paused: false, cancelling: false, isRunning: true })
        }}
        onCancel={() => {
          void dialog
            .confirm(
              t(
                'settings.rag_batch_embed_cancel_confirm',
                '取消后将停止尚未开始的嵌入，已经写入的向量会保留。确定取消？'
              ),
              { title: t('common.warning', '警告') }
            )
            .then((ok) => {
              if (!ok) return
              services?.ragService.requestOperationAbort()
              patchCachedMobileRagState({ cancelling: true, paused: false })
            })
        }}
      />
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: {},
  onboardingTitle: {
    fontSize: settingsTypography.section.fontSize,
    fontWeight: settingsTypography.section.fontWeight
  },
  onboardingActions: { flexDirection: 'row', flexWrap: 'wrap' }
})
