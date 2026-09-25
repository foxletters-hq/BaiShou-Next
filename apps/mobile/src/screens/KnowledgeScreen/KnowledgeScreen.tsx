import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, FlatList, ActivityIndicator, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Plus } from 'lucide-react-native'
import { getNotebookCardAppearance } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, useDialog, useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import {
  mobileCreateNotebook,
  mobileDeleteNotebook,
  mobileListNotebooks,
  mobileListNotebookStats,
  mobileReorderNotebooks,
  mobileResolveNotebookCoverUri,
  mobileUpdateNotebook
} from '@/src/services/mobile-knowledge.service'
import { KnowledgeNotebookDeleteDialog } from './KnowledgeNotebookDeleteDialog'
import {
  formatKnowledgeBytesMb,
  moveNotebookByOffset,
  NOTEBOOK_TONE_COLORS,
  resolveNotebookRename,
  sortNotebooksForMobileList,
  type KnowledgeNotebookListRow,
  type KnowledgeNotebookStats
} from './knowledge-screen.util'

type NotebookRow = KnowledgeNotebookListRow & { coverUri?: string | null }

export function KnowledgeScreen() {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const dialog = useDialog()
  const toast = useNativeToast()
  const { dbReady } = useBaishou()
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([])
  const [statsById, setStatsById] = useState<Record<string, KnowledgeNotebookStats>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<NotebookRow | null>(null)

  const refreshList = useCallback(async () => {
    const list = sortNotebooksForMobileList((await mobileListNotebooks()) as NotebookRow[])
    const withCovers = await Promise.all(
      list.map(async (item) => ({
        ...item,
        coverUri: item.coverImage ? await mobileResolveNotebookCoverUri(item.coverImage) : null
      }))
    )
    setNotebooks(withCovers)
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

  const onCreate = async () => {
    const name = await dialog.prompt(
      t('knowledge.notebook_name_placeholder', '例如：论文、项目资料'),
      '',
      t('knowledge.new_notebook', '新建笔记本')
    )
    const trimmed = name?.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      await mobileCreateNotebook({ name: trimmed })
      await refreshList()
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onRename = async (item: NotebookRow) => {
    const draft = await dialog.prompt(
      t('knowledge.notebook_name', '名称'),
      item.name,
      t('knowledge.rename_notebook', '重命名')
    )
    const next = resolveNotebookRename(item.name, draft ?? '')
    if (!next) return
    setBusy(true)
    setError('')
    try {
      await mobileUpdateNotebook({ notebookId: item.id, name: next })
      await refreshList()
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onMove = async (index: number, offset: number) => {
    const next = moveNotebookByOffset(notebooks, index, offset)
    if (!next) return
    setBusy(true)
    setError('')
    try {
      await mobileReorderNotebooks(next.map((row) => row.id))
      await refreshList()
      toast.showSuccess(t('knowledge.reorder_notebook', '已调整顺序'))
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    setError('')
    try {
      await mobileDeleteNotebook(deleting.id)
      setDeleting(null)
      await refreshList()
      toast.showSuccess(t('knowledge.notebook_deleted', '已删除笔记本'))
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const coverSize = tokens.spacing.xl + tokens.spacing.sm

  return (
    <StackScreenLayout
      title={t('knowledge.title', '知识库')}
      {...chrome}
      onBack={() => router.back()}
      headerRight={{
        icon: Plus,
        onPress: () => void onCreate(),
        disabled: busy || !dbReady,
        accessibilityLabel: t('knowledge.new_notebook', '新建笔记本')
      }}
      contentStyle={{ flex: 1, backgroundColor: colors.bgApp }}
    >
      {!dbReady ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notebooks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: tokens.spacing.md,
            paddingBottom: insets.bottom + tokens.spacing.lg,
            gap: tokens.spacing.sm
          }}
          ListEmptyComponent={
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: settingsTypography.desc.fontSize,
                fontWeight: settingsTypography.desc.fontWeight
              }}
            >
              {t('knowledge.empty_notebooks', '还没有笔记本，先新建一个主题容器。')}
            </Text>
          }
          ListHeaderComponent={
            error ? (
              <Text
                style={{
                  color: colors.error,
                  marginBottom: tokens.spacing.sm,
                  fontSize: settingsTypography.desc.fontSize
                }}
              >
                {error}
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => {
            const stats = statsById[item.id]
            const appearance = getNotebookCardAppearance(item.id, item)
            const toneColor = NOTEBOOK_TONE_COLORS[appearance.tone] || colors.primaryLight
            return (
              <Pressable onPress={() => router.push(`/knowledge/${encodeURIComponent(item.id)}`)}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
                    <View
                      style={{
                        width: coverSize,
                        height: coverSize,
                        borderRadius: tokens.radius.sm,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        backgroundColor: toneColor
                      }}
                    >
                      {item.coverUri ? (
                        <Image
                          source={{ uri: item.coverUri }}
                          style={{ width: coverSize, height: coverSize }}
                        />
                      ) : (
                        <Text style={{ fontSize: settingsTypography.section.fontSize }}>
                          {appearance.icon}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: settingsTypography.section.fontSize,
                        fontWeight: settingsTypography.section.fontWeight,
                        flex: 1
                      }}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      marginTop: tokens.spacing.sm,
                      fontSize: settingsTypography.desc.fontSize,
                      fontWeight: settingsTypography.desc.fontWeight
                    }}
                  >
                    {t('knowledge.notebook_meta', '{{sources}} 份资料 · {{chunks}} 片段', {
                      sources: stats?.sources ?? '…',
                      chunks: stats?.chunks ?? '…'
                    })}
                  </Text>
                  {stats ? (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        marginTop: tokens.spacing.xs,
                        fontSize: settingsTypography.meta.fontSize,
                        fontWeight: settingsTypography.meta.fontWeight
                      }}
                    >
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
                    <Text
                      style={{
                        color: colors.textSecondary,
                        marginTop: tokens.spacing.xs,
                        fontSize: settingsTypography.desc.fontSize
                      }}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: tokens.spacing.sm,
                      marginTop: tokens.spacing.sm
                    }}
                  >
                    <Button isDisabled={busy} onPress={() => void onRename(item)}>
                      {t('knowledge.rename_notebook', '重命名')}
                    </Button>
                    <Button isDisabled={busy || index === 0} onPress={() => void onMove(index, -1)}>
                      {t('knowledge.move_up', '上移')}
                    </Button>
                    <Button
                      isDisabled={busy || index === notebooks.length - 1}
                      onPress={() => void onMove(index, 1)}
                    >
                      {t('knowledge.move_down', '下移')}
                    </Button>
                    <Button
                      destructive
                      isDisabled={busy}
                      onPress={() => setDeleting(item)}
                    >
                      {t('knowledge.delete_notebook', '删除笔记本')}
                    </Button>
                  </View>
                </Card>
              </Pressable>
            )
          }}
        />
      )}
      <KnowledgeNotebookDeleteDialog
        visible={deleting != null}
        notebookName={deleting?.name || ''}
        busy={busy}
        onCancel={() => {
          if (busy) return
          setDeleting(null)
        }}
        onConfirm={() => void onConfirmDelete()}
      />
    </StackScreenLayout>
  )
}
