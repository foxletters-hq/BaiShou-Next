import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  isMemoryCenterTab,
  ragBatchEmbedPhaseLabelKey,
  resolveMemoryOrganizeAction,
  shouldShowMemoryOnboarding,
  type MemoryCenterTab,
  type MemoryReadinessRow,
  type PendingEmbedCounts,
  type RagBatchEmbedPhaseId,
  type RagConfig
} from '@baishou/shared'
import {
  Button,
  Card,
  SegmentedControl,
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
import {
  readMemoryOnboardingDismissed,
  writeMemoryOnboardingDismissed
} from './memory-center-onboarding.storage'
import {
  normalizeMemoryCenterRagConfig,
  readActiveVaultSafely
} from './memory-center-data.util'
import { snapshotMemoryEmbedPhases } from './memory-center-organize.util'

function rowLabel(
  id: MemoryReadinessRow['id'],
  t: (key: string, fallback: string) => string
): string {
  switch (id) {
    case 'embedding':
      return t('memory.readiness_embedding', '嵌入模型')
    case 'extract':
      return t('memory.readiness_extract', '关系抽取')
    case 'vector':
      return t('memory.readiness_vector', '向量片段')
    case 'graph':
      return t('memory.readiness_graph', '关系图谱')
  }
}

function rowValue(
  row: MemoryReadinessRow,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  if (row.state === 'missing') return t('memory.readiness_not_configured', '未配置')
  if (row.state === 'blocked') return t('memory.readiness_need_embedding', '需要先配置嵌入模型')
  if (row.state === 'pending') {
    return t('memory.readiness_vector_pending', '未整理 {{count}} 篇', { count: row.count ?? 0 })
  }
  return row.modelId || t('memory.readiness_ready', '已就绪')
}

export function MemoryCenterScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const toast = useNativeToast()
  const chrome = getStackScreenChrome(colors)
  const { dbReady, services } = useBaishou()
  const params = useLocalSearchParams<{ tab?: string }>()
  const initialTab = isMemoryCenterTab(String(params.tab ?? '')) ? (params.tab as MemoryCenterTab) : 'vectors'
  const [tab, setTab] = useState<MemoryCenterTab>(initialTab)
  const [pendingEmbedParts, setPendingEmbedParts] = useState<PendingEmbedCounts>(
    EMPTY_PENDING_EMBED_COUNTS
  )
  const [pendingGraphCount, setPendingGraphCount] = useState(0)
  const [globalModels, setGlobalModels] = useState<Record<string, unknown> | null>(null)
  const [ragConfig, setRagConfig] = useState<Pick<RagConfig, 'ragEnabled'> | null>(null)
  const [onboardingDismissed, setOnboardingDismissed] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isMemoryCenterTab(String(params.tab ?? ''))) {
      setTab(params.tab as MemoryCenterTab)
    }
  }, [params.tab])

  const refresh = useCallback(async () => {
    if (!dbReady || !services) return
    const [models, rag, dismissed, embedCounts] = await Promise.all([
      services.settingsManager.get<Record<string, unknown>>('global_models'),
      services.settingsManager.get<{ ragEnabled?: boolean }>('rag_config'),
      readMemoryOnboardingDismissed(),
      (
        services.ragService as { getPendingEmbedCounts?: () => Promise<PendingEmbedCounts> }
      )
        .getPendingEmbedCounts?.()
        .catch(() => EMPTY_PENDING_EMBED_COUNTS) ?? Promise.resolve(EMPTY_PENDING_EMBED_COUNTS)
    ])
    setGlobalModels(models ?? null)
    setRagConfig(normalizeMemoryCenterRagConfig(rag))
    setOnboardingDismissed(dismissed)
    setPendingEmbedParts(embedCounts ?? EMPTY_PENDING_EMBED_COUNTS)

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

  const pendingEmbedCount = pendingEmbedParts.total
  const embeddingConfigured = isEmbeddingConfiguredForMemory(globalModels)
  const embedSnapshot = useMemo(() => snapshotMemoryEmbedPhases(pendingEmbedParts), [pendingEmbedParts])
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
    setTab(next)
    router.setParams({ tab: next })
  }

  const startOrganize = async () => {
    if (!services) return
    const action = resolveMemoryOrganizeAction({
      embeddingConfigured,
      pendingEmbedCount
    })
    if (action === 'configure') {
      router.push('/settings/ai-models')
      return
    }
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

  return (
    <StackScreenLayout title={t('memory.title', '全局 AI 记忆')} {...chrome} onBack={() => router.back()}>
      {!dbReady ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.head, { paddingBottom: 8 }]}>
            <SegmentedControl
              value={tab}
              onChange={selectTab}
              accessibilityLabel={t('memory.tabs', '记忆类型')}
              options={[
                { value: 'vectors', label: t('memory.tab_vectors', '向量') },
                { value: 'graph', label: t('memory.tab_graph', '图谱') }
              ]}
            />
            <View style={styles.rows}>
              {rows.map((row) => (
                <View key={row.id} style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                    {rowLabel(row.id, t)}
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
                    {rowValue(row, t)}
                  </Text>
                </View>
              ))}
              {pendingEmbedCount > 0 ? (
                <Text style={[styles.rowLabel, { color: colors.textTertiary }]}>
                  {t(
                    embedSnapshot.phase === 'starting' || embedSnapshot.phase === 'finishing'
                      ? 'memory.readiness_organizing'
                      : ragBatchEmbedPhaseLabelKey(embedSnapshot.phase as RagBatchEmbedPhaseId),
                    t('memory.readiness_organizing', '正在整理记忆…')
                  )}
                  {` · ${embedSnapshot.total}`}
                </Text>
              ) : null}
            </View>
            {showOnboarding ? (
              <Card style={{ marginTop: 8 }}>
                <Text style={[styles.onboardingTitle, { color: colors.textPrimary }]}>
                  {t('memory.onboarding_title', '开始整理记忆')}
                </Text>
                {onboarding.steps.map((step) => (
                  <Text key={step.id} style={{ color: colors.textSecondary, marginTop: 4 }}>
                    {step.id === 'embed'
                      ? t('memory.onboarding_step_embed', '配置嵌入模型')
                      : step.id === 'vector'
                        ? t('memory.onboarding_step_vector', '索引向量片段')
                        : t('memory.onboarding_step_graph', '整理关系图谱')}
                    {step.count != null ? ` · ${step.count}` : ''}
                  </Text>
                ))}
                <View style={styles.onboardingActions}>
                  <Button
                    onPress={() => {
                      if (onboarding.primaryKind === 'configure') router.push('/settings/ai-models')
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
            ) : null}
          </View>
          {tab === 'vectors' ? (
            <View style={{ flex: 1 }}>
              <RAGMemorySection />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
                {t('graph.pending_entries_hint', '有 {{count}} 篇日记还没整理', {
                  count: pendingGraphCount
                })}
              </Text>
              <Button onPress={() => void startOrganize()} isDisabled={busy}>
                {t('memory.start_organize', '开始整理记忆')}
              </Button>
              <View style={{ height: 12 }} />
              <Button variant="outlined" onPress={() => router.push('/graph')}>
                {t('nav.graph', '关系图谱')}
              </Button>
            </ScrollView>
          )}
        </View>
      )}
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 16, paddingTop: 8 },
  rows: { marginTop: 12, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, flexShrink: 1, textAlign: 'right' },
  onboardingTitle: { fontSize: 16, fontWeight: '600' },
  onboardingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }
})
