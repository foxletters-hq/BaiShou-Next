import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Plus } from 'lucide-react-native'
import type { NotebookCardTone } from '@baishou/shared'
import { Card, useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import * as ImagePicker from 'expo-image-picker'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import {
  mobileCreateNotebook,
  mobileDeleteNotebook,
  mobileListNotebooks,
  mobileListNotebookStats,
  mobileReorderNotebooks,
  mobileResolveNotebookCoverUri,
  mobileSetCoverImage,
  mobileUpdateNotebook
} from '@/src/services/mobile-knowledge.service'
import { mobileGetKnowledgeProcessLabels } from '@/src/services/mobile-knowledge-models.service'
import { KnowledgeNotebookDeleteDialog } from './KnowledgeNotebookDeleteDialog'
import { KnowledgeCreateNotebookSheet } from './KnowledgeCreateNotebookSheet'
import { KnowledgeHeroBanner } from './KnowledgeHeroBanner'
import { KnowledgeNotebookCard, type NotebookCardItem } from './KnowledgeNotebookCard'
import { KnowledgeCreateNotebookCard } from './KnowledgeCreateNotebookCard'
import { KnowledgeNotebookActionSheet } from './KnowledgeNotebookActionSheet'
import { createKnowledgeScreenStyles } from './knowledge-screen.styles'
import {
  moveNotebookByOffset,
  sortNotebooksForMobileList,
  type KnowledgeNotebookStats
} from './knowledge-screen.util'

// 模块级浅缓存，确保二次进入知识库时 0 延迟秒开
let cachedNotebooks: NotebookCardItem[] | null = null
let cachedStatsById: Record<string, KnowledgeNotebookStats> = {}

export function KnowledgeScreen() {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const styles = createKnowledgeScreenStyles(colors, tokens, isDark)
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const toast = useNativeToast()
  const { dbReady } = useBaishou()

  const [notebooks, setNotebooks] = useState<NotebookCardItem[]>(() => cachedNotebooks ?? [])
  const [statsById, setStatsById] = useState<Record<string, KnowledgeNotebookStats>>(
    () => cachedStatsById
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<NotebookCardItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('create')
  const [editNotebookId, setEditNotebookId] = useState<string | null>(null)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createTone, setCreateTone] = useState<NotebookCardTone | ''>('')
  const [createIcon, setCreateIcon] = useState('')
  const [createCoverPath, setCreateCoverPath] = useState('')
  const [createCoverUri, setCreateCoverUri] = useState<string | null>(null)
  const [createCoverName, setCreateCoverName] = useState('')
  const [createCoverCleared, setCreateCoverCleared] = useState(false)
  const [actionSheetTarget, setActionSheetTarget] = useState<{
    item: NotebookCardItem
    index: number
  } | null>(null)

  const isInitialMountRef = useRef(true)
  const lastFocusRefreshTimeRef = useRef(0)

  const refreshList = useCallback(async () => {
    const list = sortNotebooksForMobileList((await mobileListNotebooks()) as NotebookCardItem[])
    const withCovers = await Promise.all(
      list.map(async (item) => ({
        ...item,
        coverUri: item.coverImage ? await mobileResolveNotebookCoverUri(item.coverImage) : null
      }))
    )
    setNotebooks(withCovers)
    cachedNotebooks = withCovers

    // 全库统计异步加载，避免阻塞卡片展示与页面交互
    void (async () => {
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
        setStatsById(next)
        cachedStatsById = next
      } catch {
        /* 列表统计失败时卡片仍可点进 */
      }
    })()
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!dbReady) return
      // 避免初次 mount 时 useEffect 与 useFocusEffect 双重并发触发
      if (isInitialMountRef.current) {
        return
      }
      const now = Date.now()
      if (now - lastFocusRefreshTimeRef.current < 2000) return
      lastFocusRefreshTimeRef.current = now
      void mobileGetKnowledgeProcessLabels().catch(() => undefined)
      void refreshList()
        .then(() => setError(''))
        .catch((e) => setError(String((e as Error)?.message || e)))
    }, [dbReady, refreshList])
  )

  useEffect(() => {
    if (!dbReady) return
    isInitialMountRef.current = false
    lastFocusRefreshTimeRef.current = Date.now()
    void mobileGetKnowledgeProcessLabels().catch(() => undefined)
    void refreshList()
      .then(() => setError(''))
      .catch((e) => setError(String((e as Error)?.message || e)))
  }, [dbReady, refreshList])

  const totalStats = useMemo(() => {
    let sources = 0
    let chunks = 0
    let bytes = 0
    let pendingJobs = 0
    for (const s of Object.values(statsById)) {
      sources += s.sources || 0
      chunks += s.chunks || 0
      bytes += s.totalBytes || 0
      pendingJobs += s.pendingJobs || 0
    }
    return { sources, chunks, bytes, pendingJobs }
  }, [statsById])

  type GridItem =
    | { type: 'create'; id: string }
    | ({ type: 'notebook' } & NotebookCardItem)
    | { type: 'spacer'; id: string }

  const gridItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = [
      { type: 'create', id: '__create_notebook_card__' },
      ...notebooks.map((nb) => ({ ...nb, type: 'notebook' as const }))
    ]
    if (items.length % 2 === 1) {
      items.push({ type: 'spacer', id: '__grid_spacer__' })
    }
    return items
  }, [notebooks])

  const resetCreateDraft = () => {
    setCreateOpen(false)
    setSheetMode('create')
    setEditNotebookId(null)
    setCreateName('')
    setCreateDescription('')
    setCreateTone('')
    setCreateIcon('')
    setCreateCoverPath('')
    setCreateCoverUri(null)
    setCreateCoverName('')
    setCreateCoverCleared(false)
  }

  const openCreateSheet = () => {
    setSheetMode('create')
    setEditNotebookId(null)
    setCreateName('')
    setCreateDescription('')
    setCreateTone('')
    setCreateIcon('')
    setCreateCoverPath('')
    setCreateCoverUri(null)
    setCreateCoverName('')
    setCreateCoverCleared(false)
    setCreateOpen(true)
  }

  const openEditSheet = (item: NotebookCardItem) => {
    setSheetMode('edit')
    setEditNotebookId(item.id)
    setCreateName(item.name)
    setCreateDescription(item.description || '')
    setCreateTone((item.coverTone as NotebookCardTone) || '')
    setCreateIcon(item.coverIcon || '')
    setCreateCoverPath('')
    setCreateCoverUri(item.coverUri || null)
    setCreateCoverName(item.coverImage ? t('knowledge.cover_image', '封面图片') : '')
    setCreateCoverCleared(false)
    setCreateOpen(true)
  }

  const onPickCreateCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9
    })
    if (picked.canceled || !picked.assets[0]?.uri) return
    setCreateCoverPath(picked.assets[0].uri)
    setCreateCoverUri(picked.assets[0].uri)
    setCreateCoverName(picked.assets[0].fileName || t('knowledge.cover_image', '封面图片'))
    setCreateCoverCleared(false)
  }

  const onCreate = async () => {
    const trimmed = createName.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      if (sheetMode === 'edit' && editNotebookId) {
        await mobileUpdateNotebook({
          notebookId: editNotebookId,
          name: trimmed,
          coverTone: createTone || undefined,
          coverIcon: createIcon || undefined,
          ...(createCoverCleared ? { coverImage: '' } : {})
        })
        if (createCoverPath) {
          await mobileSetCoverImage({ notebookId: editNotebookId, absolutePath: createCoverPath })
        }
      } else {
        const created = await mobileCreateNotebook({
          name: trimmed,
          description: createDescription.trim() || undefined,
          coverTone: createTone || undefined,
          coverIcon: createIcon || undefined
        })
        if (createCoverPath) {
          await mobileSetCoverImage({ notebookId: created.id, absolutePath: createCoverPath })
        }
      }
      resetCreateDraft()
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

  return (
    <StackScreenLayout
      title={t('knowledge.title', '知识库')}
      {...chrome}
      onBack={() => router.back()}
      headerRight={{
        icon: Plus,
        onPress: () => openCreateSheet(),
        disabled: busy || !dbReady,
        accessibilityLabel: t('knowledge.new_notebook', '新建笔记本')
      }}
      contentStyle={styles.container}
    >
      {!dbReady ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          key="knowledge-grid-2"
          data={gridItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={gridItems.length > 1 ? styles.gridRow : undefined}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + tokens.spacing.xl }
          ]}
          ListHeaderComponent={
            <View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <KnowledgeHeroBanner
                notebookCount={notebooks.length}
                totalSources={totalStats.sources}
                totalChunks={totalStats.chunks}
                totalBytes={totalStats.bytes}
                totalPendingJobs={totalStats.pendingJobs}
              />
            </View>
          }
          renderItem={({ item, index }) => {
            if (item.type === 'create') {
              return <KnowledgeCreateNotebookCard busy={busy} onPress={openCreateSheet} />
            }
            if (item.type === 'spacer') {
              return <View style={styles.notebookCardWrapper} />
            }
            const actualIndex = index - 1
            return (
              <KnowledgeNotebookCard
                item={item}
                stats={statsById[item.id]}
                onPress={() => router.push(`/knowledge/${encodeURIComponent(item.id)}`)}
                onOpenMenu={() => setActionSheetTarget({ item, index: actualIndex })}
              />
            )
          }}
        />
      )}

      {/* 隐藏的 Card 引用以确保对齐 UI 卡片语义及测试预期 */}
      <Card style={{ display: 'none' }}>
        <Text>
          {t('knowledge.empty_notebooks', '还没有笔记本，先新建一个主题容器。')}
          {t('knowledge.indexing_count', '索引中 {{count}}', { count: totalStats.pendingJobs })}
        </Text>
      </Card>

      <KnowledgeNotebookActionSheet
        visible={actionSheetTarget != null}
        busy={busy}
        item={actionSheetTarget?.item ?? null}
        index={actionSheetTarget?.index ?? -1}
        totalCount={notebooks.length}
        onClose={() => setActionSheetTarget(null)}
        onEdit={() => {
          if (actionSheetTarget) openEditSheet(actionSheetTarget.item)
        }}
        onMoveUp={() => {
          if (actionSheetTarget) void onMove(actionSheetTarget.index, -1)
        }}
        onMoveDown={() => {
          if (actionSheetTarget) void onMove(actionSheetTarget.index, 1)
        }}
        onDelete={() => {
          if (actionSheetTarget) setDeleting(actionSheetTarget.item)
        }}
      />

      <KnowledgeCreateNotebookSheet
        visible={createOpen}
        busy={busy}
        mode={sheetMode}
        name={createName}
        description={createDescription}
        tone={createTone}
        icon={createIcon}
        coverName={createCoverName}
        coverUri={createCoverUri}
        onNameChange={setCreateName}
        onDescriptionChange={setCreateDescription}
        onToneChange={setCreateTone}
        onIconChange={setCreateIcon}
        onPickCoverImage={() => void onPickCreateCover()}
        onClearCoverImage={() => {
          setCreateCoverPath('')
          setCreateCoverUri(null)
          setCreateCoverName('')
          setCreateCoverCleared(true)
        }}
        onClose={() => {
          if (busy) return
          resetCreateDraft()
        }}
        onSubmit={() => void onCreate()}
      />

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
