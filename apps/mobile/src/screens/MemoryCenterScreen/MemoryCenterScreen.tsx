import React, { useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  filterProvidersForModelSwitcher,
  formatReasoningEffortLabel,
  resolveReasoningEffortForSlot,
  type MemoryCenterTab
} from '@baishou/shared'
import {
  Button,
  ModelSwitcher,
  modalActionsStyle,
  SegmentedContent,
  SegmentedControl,
  useNativeTheme
} from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { RAGMemorySection } from '../SettingsScreen/components/RAGMemorySection'
import { useMobileSuspectCount } from '@/src/hooks/useMobileSuspectCount'
import {
  MemoryOnboardingHost,
  MemoryOrganizeFabHost,
  MemoryOrganizeProgressHost
} from './MemoryOrganizeChrome'
import {
  MemoryReadinessConfigModal,
  MemoryReadinessSettingsBody
} from './MemoryReadinessConfigModal'
import { GraphScreen } from '../GraphScreen/GraphScreen'
import { SettingsProfileModal } from '../SettingsScreen/components/SettingsProfileModal'
import { MemoryCenterOnboardingCard } from './MemoryCenterOnboardingCard'
import { resolveMemoryCenterTabParam } from './memory-center-data.util'
import { useMemoryCenterData } from './useMemoryCenterData'
import { useMemoryCenterOrganize } from './useMemoryCenterOrganize'

export function MemoryCenterScreen() {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const params = useLocalSearchParams<{ tab?: string | string[] }>()
  const tabParam = resolveMemoryCenterTabParam(params.tab)
  const [tab, setTab] = useState<MemoryCenterTab>(tabParam ?? 'vectors')
  const [configOpen, setConfigOpen] = useState(false)
  const { suspectCount } = useMobileSuspectCount()
  const {
    dbReady,
    providers,
    globalModels,
    rows,
    showOnboarding,
    onboarding,
    pendingEmbedParts,
    pendingGraphCount,
    organizeSnapshotReady,
    refresh,
    setGlobalModels,
    setProviders,
    dismissOnboarding
  } = useMemoryCenterData()
  const {
    modelPicker,
    openModelPicker,
    closeModelPicker,
    handleSelectPickedModel,
    handleSaveIdentityModal,
    identityModalVisible,
    identityModalProfile,
    closeIdentityModal,
    busy,
    onStartOrganize,
    onOrganizePress,
    onUnifiedOrganize
  } = useMemoryCenterOrganize({
    globalModels,
    providers,
    pendingEmbedParts,
    pendingGraphCount,
    organizeSnapshotReady,
    refresh,
    setGlobalModels,
    setProviders
  })

  useEffect(() => {
    if (!tabParam) return
    setTab((prev) => (prev === tabParam ? prev : tabParam))
  }, [tabParam])

  const selectTab = (next: MemoryCenterTab) => {
    if (next === tab) return
    setTab(next)
    router.setParams({ tab: next })
  }

  const extractEffortLabel = globalModels
    ? formatReasoningEffortLabel(
        resolveReasoningEffortForSlot(globalModels.reasoningEffortBySlot, 'graph')
      )
    : undefined

  const readinessSettings = (
    <MemoryReadinessSettingsBody
      rows={rows}
      providers={providers}
      extractEffortLabel={extractEffortLabel}
      onPressEmbedding={() => openModelPicker('embedding')}
      onPressExtract={() => openModelPicker('extract')}
    />
  )

  const onboardingCard = showOnboarding ? (
    <MemoryOnboardingHost
      pendingEmbedParts={pendingEmbedParts}
      pendingGraphCount={pendingGraphCount}
      organizeSnapshotReady={organizeSnapshotReady}
    >
      <MemoryCenterOnboardingCard
        onboarding={onboarding}
        onConfigure={() => openModelPicker('embedding')}
        onStartOrganize={onOrganizePress}
        onDismiss={dismissOnboarding}
      />
    </MemoryOnboardingHost>
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
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom:
                insets.bottom + tokens.spacing.xl + tokens.spacing.xl + tokens.spacing.md
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.head,
                {
                  paddingBottom: tokens.spacing.sm,
                  paddingHorizontal: tokens.spacing.md,
                  paddingTop: tokens.spacing.mdTight
                }
              ]}
            >
              <View style={{ alignSelf: 'stretch' }}>
                <SegmentedControl
                  value={tab}
                  onChange={selectTab}
                  accessibilityLabel={t('memory.tabs', '记忆类型')}
                  options={[
                    { value: 'vectors', label: t('memory.tab_vectors', '向量片段') },
                    { value: 'graph', label: t('memory.tab_graph', '关系图谱') }
                  ]}
                />
              </View>
              {tab === 'graph' && suspectCount > 0 ? (
                <View style={[modalActionsStyle, { marginTop: tokens.spacing.sm }]}>
                  <Button variant="outlined" size="sm" onPress={() => router.push('/graph-review')}>
                    {t('memory.review_suspects', '去检查')}
                  </Button>
                </View>
              ) : null}
              <MemoryOrganizeProgressHost
                pendingEmbedParts={pendingEmbedParts}
                pendingGraphCount={pendingGraphCount}
                organizeSnapshotReady={organizeSnapshotReady}
                onStartOrganize={onStartOrganize}
              />
            </View>
            <SegmentedContent value={tab} style={{ flexGrow: 1, minHeight: 0 }}>
              {tab === 'vectors' ? (
                <View style={{ paddingHorizontal: tokens.spacing.md }}>
                  {onboardingCard}
                  <RAGMemorySection hideStats compactChrome settingsLead={readinessSettings} />
                </View>
              ) : (
                <View style={{ flexGrow: 1 }}>
                  {onboardingCard ? (
                    <View style={{ paddingHorizontal: tokens.spacing.md }}>{onboardingCard}</View>
                  ) : null}
                  <MemoryGraphPane onUnifiedOrganize={onUnifiedOrganize} />
                </View>
              )}
            </SegmentedContent>
          </ScrollView>
          <MemoryOrganizeFabHost
            pendingEmbedParts={pendingEmbedParts}
            pendingGraphCount={pendingGraphCount}
            organizeSnapshotReady={organizeSnapshotReady}
            busy={busy}
            fabBottom={insets.bottom + tokens.spacing.lg + tokens.spacing.md}
            onStartOrganize={onStartOrganize}
          />
        </View>
      )}
      <MemoryReadinessConfigModal
        visible={configOpen}
        rows={rows}
        providers={providers}
        extractEffortLabel={extractEffortLabel}
        onClose={() => setConfigOpen(false)}
        onPressEmbedding={() => openModelPicker('embedding')}
        onPressExtract={() => openModelPicker('extract')}
      />
      <ModelSwitcher
        isOpen={modelPicker !== null}
        onClose={closeModelPicker}
        providers={filterProvidersForModelSwitcher(
          providers,
          modelPicker === 'embedding' ? 'embedding' : 'dialogue'
        )}
        currentProviderId={
          modelPicker === 'extract'
            ? globalModels?.globalGraphProviderId
            : globalModels?.globalEmbeddingProviderId
        }
        currentModelId={
          modelPicker === 'extract'
            ? globalModels?.globalGraphModelId
            : globalModels?.globalEmbeddingModelId
        }
        onSelect={(providerId, modelId, effort) => {
          void handleSelectPickedModel(providerId, modelId, effort)
        }}
        onManageProviders={() => {
          closeModelPicker()
          router.push('/settings/ai-services')
        }}
        showReasoningPanel={modelPicker === 'extract'}
        reasoningEffort={
          modelPicker === 'extract'
            ? resolveReasoningEffortForSlot(globalModels?.reasoningEffortBySlot, 'graph')
            : 'auto'
        }
      />
      <SettingsProfileModal
        visible={identityModalVisible}
        onClose={closeIdentityModal}
        profile={identityModalProfile}
        onSave={handleSaveIdentityModal}
      />
    </StackScreenLayout>
  )
}

const MemoryGraphPane = React.memo(function MemoryGraphPane(props: {
  onUnifiedOrganize: () => void | Promise<void>
}) {
  return <GraphScreen embedded onUnifiedOrganize={props.onUnifiedOrganize} />
})

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: {}
})
