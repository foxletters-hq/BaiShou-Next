import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getNotebookCardAppearance } from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import {
  mobileListNotebooks,
  mobileListNotebookStats
} from '@/src/services/mobile-knowledge.service'
import {
  formatKnowledgeBytesMb,
  NOTEBOOK_TONE_COLORS,
  type KnowledgeNotebookStats
} from './knowledge-screen.util'

type NotebookRow = {
  id: string
  name: string
  description?: string
  coverTone?: string
  coverIcon?: string
  coverImage?: string
}

export function KnowledgeScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const { dbReady } = useBaishou()
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([])
  const [statsById, setStatsById] = useState<Record<string, KnowledgeNotebookStats>>({})
  const [error, setError] = useState('')

  const refreshList = useCallback(async () => {
    const list = (await mobileListNotebooks()) as NotebookRow[]
    setNotebooks(list || [])
    const next: Record<string, KnowledgeNotebookStats> = {}
    try {
      const statsList = await mobileListNotebookStats()
      for (const row of statsList) {
        next[row.notebookId] = {
          sources: row.sources,
          chunks: row.chunks,
          pendingJobs: row.pendingJobs,
          originalBytes: row.originalBytes ?? 0,
          totalBytes: row.totalBytes ?? 0
        }
      }
    } catch {
      /* 列表统计失败时卡片仍可点进 */
    }
    setStatsById(next)
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!dbReady) return
      void refreshList().catch((e) => setError(String((e as Error)?.message || e)))
    }, [dbReady, refreshList])
  )

  useEffect(() => {
    if (!dbReady) return
    void refreshList().catch((e) => setError(String((e as Error)?.message || e)))
  }, [dbReady, refreshList])

  return (
    <StackScreenLayout
      title={t('knowledge.title', '知识库')}
      {...chrome}
      onBack={() => router.back()}
      contentStyle={{ flex: 1 }}
    >
      {!dbReady ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notebooks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary }}>
              {t('knowledge.empty_notebooks_mobile', '还没有笔记本。请在桌面端创建并同步。')}
            </Text>
          }
          ListHeaderComponent={
            error ? <Text style={{ color: colors.error, marginBottom: 8 }}>{error}</Text> : null
          }
          renderItem={({ item }) => {
            const stats = statsById[item.id]
            const appearance = getNotebookCardAppearance(item.id, item)
            const toneColor = NOTEBOOK_TONE_COLORS[appearance.tone] || colors.primaryLight
            return (
              <Pressable
                onPress={() => router.push(`/knowledge/${encodeURIComponent(item.id)}`)}
                style={[
                  styles.card,
                  { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }
                ]}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.cover, { backgroundColor: toneColor }]}>
                    <Text style={styles.coverIcon}>{appearance.icon}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                </View>
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                  {t('knowledge.notebook_meta', '{{sources}} 份资料 · {{chunks}} 片段', {
                    sources: stats?.sources ?? '…',
                    chunks: stats?.chunks ?? '…'
                  })}
                </Text>
                {stats ? (
                  <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {t(
                      'knowledge.storage_usage',
                      '本笔记本 {{total}} MB，其中原文 {{original}} MB',
                      {
                        total: formatKnowledgeBytesMb(stats.totalBytes),
                        original: formatKnowledgeBytesMb(stats.originalBytes)
                      }
                    )}
                  </Text>
                ) : null}
                {item.description ? (
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </Pressable>
            )
          }}
        />
      )}
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  coverIcon: { fontSize: 20 },
  cardTitle: { fontSize: 17, fontWeight: '600', flex: 1 }
})
