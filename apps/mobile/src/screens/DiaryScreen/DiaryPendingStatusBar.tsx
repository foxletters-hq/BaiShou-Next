import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  shouldShowPendingEmbed,
  shouldShowPendingExtract,
  type PendingEmbedCounts
} from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { diaryScreenStyles as styles } from './diary-screen.styles'

export function DiaryPendingStatusBar(props: {
  graphConfigured: boolean
  ragConfigured: boolean
  pendingGraphCount: number
  pendingEmbedCount: number
  pendingEmbedParts: PendingEmbedCounts
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const {
    graphConfigured,
    ragConfigured,
    pendingGraphCount,
    pendingEmbedCount,
    pendingEmbedParts
  } = props

  return (
    <View
      style={[
        styles.statusBar,
        { borderTopColor: colors.borderMuted, backgroundColor: colors.bgApp }
      ]}
    >
      {shouldShowPendingExtract({
        graphConfigured,
        count: pendingGraphCount
      }) ? (
        <Text style={[styles.statusItem, { color: colors.textSecondary }]}>
          {t('diary.status_pending_extract', '待抽取：{{count}}个', {
            count: pendingGraphCount
          })}
        </Text>
      ) : null}
      {shouldShowPendingEmbed({ ragConfigured, count: pendingEmbedCount }) ? (
        <Text style={[styles.statusItem, { color: colors.textSecondary }]}>
          {t('diary.status_pending_embed', '待嵌入：{{count}}个', {
            count: pendingEmbedCount
          })}
          {`（${t('memory.pending_embed_part_diaries', '日记 {{count}} 篇', {
            count: pendingEmbedParts.diaries
          })} · ${t('memory.pending_embed_part_memories', '伙伴记忆 {{count}} 条', {
            count: pendingEmbedParts.memories
          })} · ${t('memory.pending_embed_part_graph_nodes', '图谱节点 {{count}} 个', {
            count: pendingEmbedParts.graphNodes
          })} · ${t('memory.pending_embed_part_notebook_graph_nodes', '笔记本图节点 {{count}} 个', {
            count: pendingEmbedParts.notebookGraphNodes
          })} · ${t('memory.pending_embed_part_knowledge', '知识库 {{count}} 份', {
            count: pendingEmbedParts.knowledgeSources
          })}）`}
        </Text>
      ) : null}
    </View>
  )
}
