import React from 'react'
import { View, Text, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getNotebookCardAppearance } from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { KnowledgeDetailCoverSection } from './KnowledgeDetailCoverSection'
import { KnowledgeDetailImportSection } from './KnowledgeDetailImportSection'
import { KnowledgeDetailManageSection } from './KnowledgeDetailManageSection'
import { KnowledgeDetailSourcesSection } from './KnowledgeDetailSourcesSection'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import { useKnowledgeDetail } from './useKnowledgeDetail'

export function KnowledgeDetailScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const params = useLocalSearchParams<{ notebookId?: string }>()
  const notebookId = decodeURIComponent(String(params.notebookId ?? '').trim())
  const detail = useKnowledgeDetail(notebookId)
  const appearance = getNotebookCardAppearance(notebookId, {
    coverTone: detail.coverTone,
    coverIcon: detail.coverIcon
  })

  return (
    <StackScreenLayout
      title={detail.name || t('knowledge.title', '知识库')}
      {...chrome}
      onBack={() => router.back()}
      contentStyle={{ flex: 1 }}
    >
      {!detail.dbReady || !notebookId ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <KnowledgeDetailCoverSection
            name={detail.name}
            coverTone={detail.coverTone}
            coverIcon={detail.coverIcon}
            coverImage={detail.coverImage}
            coverUri={detail.coverUri}
            appearance={appearance}
            stats={detail.stats}
            busy={detail.busy}
            modelMismatch={detail.modelMismatch}
            onSaveCover={(patch) => void detail.saveCover(patch)}
            onPickCoverImage={() => void detail.pickCoverImage()}
            onRebuildIndex={() => void detail.rebuildIndex()}
          />
          <KnowledgeDetailImportSection
            busy={detail.busy}
            showImport={detail.showImport}
            pasteTitle={detail.pasteTitle}
            pasteText={detail.pasteText}
            urlValue={detail.urlValue}
            onShowImport={detail.setShowImport}
            onPasteTitle={detail.setPasteTitle}
            onPasteText={detail.setPasteText}
            onUrlValue={detail.setUrlValue}
            onImportText={detail.onImportText}
            onImportUrl={detail.onImportUrl}
          />
          <KnowledgeDetailSourcesSection
            sources={detail.sources}
            busy={detail.busy}
            onRetrySource={detail.retrySource}
            onReprocessGraph={detail.reprocessSourceGraph}
            onDeleteSource={detail.onDeleteSource}
          />
          <KnowledgeDetailManageSection
            graphNodes={detail.graphNodes}
            graphEdges={detail.graphEdges}
            sourceCount={detail.sources.length}
            manageAction={detail.manageAction}
            manageVector={detail.manageVector}
            manageGraph={detail.manageGraph}
            clearPhrase={detail.clearPhrase}
            phrase={detail.phrase}
            canConfirm={detail.canConfirm}
            busy={detail.busy}
            onStartOrganize={detail.startOrganize}
            onRebuildGraph={detail.rebuildNotebookGraph}
            onManageAction={detail.setManageAction}
            onToggleVector={() => detail.setManageVector((v) => !v)}
            onToggleGraph={() => detail.setManageGraph((v) => !v)}
            onClearPhrase={detail.setClearPhrase}
            onConfirmManage={detail.confirmManage}
          />
          <Text style={[styles.mountHint, { color: colors.textSecondary }]}>
            {t('knowledge.mount_hint', '资料嵌入完成后，可以在软件内和 AI 对话时挂载。')}
          </Text>
          {detail.error ? (
            <Text style={{ color: colors.error, marginTop: 8 }}>{detail.error}</Text>
          ) : null}
        </ScrollView>
      )}
    </StackScreenLayout>
  )
}
