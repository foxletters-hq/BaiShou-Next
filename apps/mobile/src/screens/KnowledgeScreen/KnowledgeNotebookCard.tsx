import React from 'react'
import { View, Text, Pressable, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MoreVertical } from 'lucide-react-native'
import { Card, useNativeTheme } from '@baishou/ui/native'
import { getNotebookCardAppearance } from '@baishou/shared'
import { createKnowledgeScreenStyles } from './knowledge-screen.styles'
import {
  formatKnowledgeBytesMb,
  NOTEBOOK_TONE_COLORS,
  type KnowledgeNotebookListRow,
  type KnowledgeNotebookStats
} from './knowledge-screen.util'

export type NotebookCardItem = KnowledgeNotebookListRow & { coverUri?: string | null }

export interface KnowledgeNotebookCardProps {
  item: NotebookCardItem
  stats?: KnowledgeNotebookStats
  onPress: () => void
  onOpenMenu: () => void
}

export function KnowledgeNotebookCard({
  item,
  stats,
  onPress,
  onOpenMenu
}: KnowledgeNotebookCardProps) {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const styles = createKnowledgeScreenStyles(colors, tokens, isDark)

  const appearance = getNotebookCardAppearance(item.id, item)
  const toneColor = NOTEBOOK_TONE_COLORS[appearance.tone] || colors.primaryLight

  return (
    <View style={styles.notebookCardWrapper}>
      <Pressable
        onPress={onPress}
        onLongPress={onOpenMenu}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <Card style={styles.notebookCardInner}>
          <View style={[styles.coverArea, { backgroundColor: toneColor }]}>
            {item.coverUri ? (
              <>
                <Image
                  source={{ uri: item.coverUri }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
                <View style={styles.coverOverlay} />
              </>
            ) : (
              <Text style={styles.coverEmoji}>{appearance.icon}</Text>
            )}

            <Pressable
              style={styles.coverMenuBtn}
              onPress={(e) => {
                e.stopPropagation()
                onOpenMenu()
              }}
              accessibilityRole="button"
              accessibilityLabel={t('knowledge.more_options', '更多操作')}
              hitSlop={8}
            >
              <MoreVertical size={16} color={item.coverUri ? '#f8fafc' : colors.textPrimary} />
            </Pressable>

            {stats && stats.pendingJobs > 0 ? (
              <View style={styles.cardPendingPill}>
                <Text style={styles.cardPendingText}>
                  {t('knowledge.indexing_count', '索引中 {{count}}', {
                    count: stats.pendingJobs
                  })}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.notebookName} numberOfLines={2}>
              {item.name}
            </Text>

            <Text style={styles.notebookMeta} numberOfLines={1}>
              {t('knowledge.notebook_meta', '{{sources}} 份资料 · {{chunks}} 片段', {
                sources: stats?.sources ?? '0',
                chunks: stats?.chunks ?? '0'
              })}
            </Text>

            {stats ? (
              <Text style={styles.notebookStorage} numberOfLines={1}>
                {t('knowledge.storage_usage', '本笔记本 {{total}} MB，其中原文 {{original}} MB', {
                  total: formatKnowledgeBytesMb(stats.totalBytes),
                  original: formatKnowledgeBytesMb(stats.originalBytes)
                })}
              </Text>
            ) : null}

            {item.description ? (
              <Text style={styles.notebookDesc} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </Card>
      </Pressable>
    </View>
  )
}
