import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import {
  NOTEBOOK_CARD_ICONS,
  NOTEBOOK_CARD_TONES,
  canConfirmNotebookDataManage,
  getNotebookCardAppearance,
  notebookDataManageStatusKind,
  parseNotebookDataManageResult,
  type NotebookDataManageAction
} from '@baishou/shared'
import {
  Button,
  Checkbox,
  HelpTooltip,
  Input,
  Tooltip,
  SegmentedControl,
  useDialog,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import {
  mobileDeleteSource,
  mobileGetKnowledgeStats,
  mobileGetNotebook,
  mobileGetNotebookGraphView,
  mobileHasKnowledgeModelMismatch,
  mobileImportSource,
  mobileListSources,
  mobileManageNotebookData,
  mobileRebuildKnowledgeIndex,
  mobileResolveNotebookCoverUri,
  mobileSetCoverImage,
  mobileUpdateNotebook
} from '@/src/services/mobile-knowledge.service'
import {
  formatKnowledgeBytesMb,
  knowledgeSourceStatusLabel,
  NOTEBOOK_TONE_COLORS,
  type KnowledgeNotebookStats
} from './knowledge-screen.util'

type SourceRow = {
  id: string
  title: string
  status: string
  errorMessage?: string | null
}

export function KnowledgeDetailScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const toast = useNativeToast()
  const dialog = useDialog()
  const chrome = getStackScreenChrome(colors)
  const { dbReady } = useBaishou()
  const params = useLocalSearchParams<{ notebookId?: string }>()
  const notebookId = decodeURIComponent(String(params.notebookId ?? '').trim())

  const [name, setName] = useState('')
  const [coverTone, setCoverTone] = useState('')
  const [coverIcon, setCoverIcon] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverUri, setCoverUri] = useState<string | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])
  const [stats, setStats] = useState<KnowledgeNotebookStats | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modelMismatch, setModelMismatch] = useState(false)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [showImport, setShowImport] = useState<'text' | 'url' | null>(null)
  const [graphNodes, setGraphNodes] = useState<Array<{ id: string; name: string; nodeType: string }>>(
    []
  )
  const [graphEdges, setGraphEdges] = useState<
    Array<{ id: string; fromId: string; toId: string; edgeType: string }>
  >([])
  const [manageAction, setManageAction] = useState<NotebookDataManageAction>('reprocess')
  const [manageVector, setManageVector] = useState(true)
  const [manageGraph, setManageGraph] = useState(true)
  const [clearPhrase, setClearPhrase] = useState('')

  const refreshDetail = useCallback(async () => {
    if (!notebookId) return
    const notebook = await mobileGetNotebook(notebookId)
    if (!notebook) throw new Error(t('knowledge.not_found', '找不到这本笔记本'))
    setName(notebook.name)
    setCoverTone(notebook.coverTone || '')
    setCoverIcon(notebook.coverIcon || '')
    setCoverImage(notebook.coverImage || '')
    const uri = notebook.coverImage
      ? await mobileResolveNotebookCoverUri(notebook.coverImage)
      : null
    setCoverUri(uri)
    const list = (await mobileListSources(notebookId)) as SourceRow[]
    setSources(list || [])
    try {
      const next = await mobileGetKnowledgeStats(notebookId)
      setStats({
        sources: next.sources,
        chunks: next.chunks,
        pendingJobs: next.pendingJobs,
        originalBytes: next.originalBytes ?? 0,
        totalBytes: next.totalBytes ?? 0
      })
    } catch {
      /* 统计失败时仍刷新资料 */
    }
    try {
      setModelMismatch(await mobileHasKnowledgeModelMismatch([notebookId]))
    } catch {
      setModelMismatch(false)
    }
    try {
      const view = await mobileGetNotebookGraphView(notebookId, 80)
      setGraphNodes((view.nodes || []).map((n) => ({ id: n.id, name: n.name, nodeType: n.nodeType })))
      setGraphEdges(
        (view.edges || []).map((e) => ({
          id: e.id,
          fromId: e.fromId,
          toId: e.toId,
          edgeType: e.edgeType
        }))
      )
    } catch {
      setGraphNodes([])
      setGraphEdges([])
    }
  }, [notebookId, t])

  useEffect(() => {
    if (!dbReady || !notebookId) return
    void refreshDetail().catch((e) => setError(String((e as Error)?.message || e)))
  }, [dbReady, notebookId, refreshDetail])

  const hasActiveIngest =
    sources.some(
      (s) => s.status === 'pending' || s.status === 'extracting' || s.status === 'embedding'
    ) || (stats?.pendingJobs ?? 0) > 0

  useEffect(() => {
    if (!hasActiveIngest) return
    const timer = setInterval(() => {
      void refreshDetail().catch(() => undefined)
    }, 4000)
    return () => clearInterval(timer)
  }, [hasActiveIngest, refreshDetail])

  const appearance = getNotebookCardAppearance(notebookId, { coverTone, coverIcon })
  const phrase = t('knowledge.data_manage_clear_phrase', '确认清除')
  const canConfirm = canConfirmNotebookDataManage({
    action: manageAction,
    vector: manageVector,
    graph: manageGraph,
    phrase,
    typed: clearPhrase
  })

  const saveCover = async (patch: {
    coverTone?: string | null
    coverIcon?: string | null
    coverImage?: string | null
  }) => {
    setBusy(true)
    setError('')
    try {
      const updated = await mobileUpdateNotebook({ notebookId, ...patch })
      setCoverTone(updated.coverTone || '')
      setCoverIcon(updated.coverIcon || '')
      setCoverImage(updated.coverImage || '')
      setCoverUri(updated.coverImage ? await mobileResolveNotebookCoverUri(updated.coverImage) : null)
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportText = async () => {
    if (!pasteText.trim()) return
    setBusy(true)
    setError('')
    try {
      await mobileImportSource({
        notebookId,
        title: pasteTitle.trim() || t('knowledge.pasted_text', '粘贴文本'),
        kind: 'text',
        textContent: pasteText
      })
      setPasteTitle('')
      setPasteText('')
      setShowImport(null)
      await refreshDetail()
      toast.showSuccess(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportUrl = async () => {
    const originUrl = urlValue.trim()
    if (!originUrl) return
    setBusy(true)
    setError('')
    try {
      await mobileImportSource({
        notebookId,
        title: '',
        kind: 'url',
        originUrl
      })
      setUrlValue('')
      setShowImport(null)
      await refreshDetail()
      toast.showSuccess(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onDeleteSource = async (source: SourceRow) => {
    const ok = await dialog.confirm(
      t(
        'knowledge.delete_source_confirm',
        '将删除「{{title}}」的原文和提取结果，并清空这份资料对应的图关系和向量数据。此操作不能恢复。',
        { title: source.title }
      ),
      {
        title: t('knowledge.delete_source_title', '删除资料'),
        confirmText: t('knowledge.delete_source', '删除'),
        cancelText: t('common.cancel', '取消'),
        destructive: true
      }
    )
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      await mobileDeleteSource(source.id)
      await refreshDetail()
      toast.showSuccess(t('knowledge.source_deleted', '已删除资料'))
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onManage = async () => {
    if (!canConfirm || busy) return
    setBusy(true)
    setError('')
    try {
      const raw = await mobileManageNotebookData(notebookId, {
        action: manageAction,
        vector: manageVector,
        graph: manageGraph
      })
      const parsed = parseNotebookDataManageResult(raw)
      if (!parsed) throw new Error(t('knowledge.data_manage_failed', '数据管理未完成'))
      const kind = notebookDataManageStatusKind(parsed)
      if (kind === 'cleared') toast.showSuccess(t('knowledge.data_manage_cleared', '已清除派生数据'))
      else if (kind === 'reprocess-queued') {
        toast.showSuccess(t('knowledge.data_manage_queued', '已加入重整理队列'))
      } else {
        toast.showInfo(t('knowledge.data_manage_none', '没有可重整理的资料'))
      }
      setClearPhrase('')
      await refreshDetail()
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <StackScreenLayout
      title={name || t('knowledge.title', '知识库')}
      {...chrome}
      onBack={() => router.back()}
      contentStyle={{ flex: 1 }}
    >
      {!dbReady || !notebookId ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.coverRow}>
            <View
              style={[
                styles.coverPreview,
                { backgroundColor: NOTEBOOK_TONE_COLORS[appearance.tone] || colors.primaryLight }
              ]}
            >
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverImage} />
              ) : (
                <Text style={styles.coverEmoji}>{appearance.icon}</Text>
              )}
            </View>
            <Text style={[styles.h1, { color: colors.textPrimary }]}>{name}</Text>
          </View>
          {stats ? (
            <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
              {t('knowledge.storage_usage', '本笔记本 {{total}} MB，其中原文 {{original}} MB', {
                total: formatKnowledgeBytesMb(stats.totalBytes),
                original: formatKnowledgeBytesMb(stats.originalBytes)
              })}
              {stats.pendingJobs > 0
                ? ` · ${t('knowledge.indexing', '索引中')} ${stats.pendingJobs}`
                : ''}
            </Text>
          ) : null}

          <Text style={[styles.section, { color: colors.textPrimary }]}>
            {t('knowledge.cover_image', '封面图片')}
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {t('knowledge.cover_tone', '色调')}
          </Text>
          <View style={styles.chipWrap}>
            {NOTEBOOK_CARD_TONES.map((tone) => (
              <Pressable
                key={tone}
                onPress={() => void saveCover({ coverTone: tone })}
                style={[
                  styles.toneChip,
                  {
                    backgroundColor: NOTEBOOK_TONE_COLORS[tone],
                    borderColor: coverTone === tone ? colors.primary : colors.borderMuted
                  }
                ]}
              />
            ))}
          </View>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {t('knowledge.cover_icon', '图标')}
          </Text>
          <View style={styles.chipWrap}>
            {NOTEBOOK_CARD_ICONS.map((icon) => (
              <Pressable
                key={icon}
                onPress={() => void saveCover({ coverIcon: icon })}
                style={[
                  styles.iconChip,
                  {
                    borderColor: coverIcon === icon ? colors.primary : colors.borderMuted,
                    backgroundColor: colors.bgSurface
                  }
                ]}
              >
                <Text>{icon}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.rowGap}>
            <Button
              isDisabled={busy}
              onPress={() => {
                void (async () => {
                  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
                  if (!perm.granted) return
                  const picked = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    quality: 0.9
                  })
                  if (picked.canceled || !picked.assets[0]?.uri) return
                  setBusy(true)
                  try {
                    await mobileSetCoverImage({
                      notebookId,
                      absolutePath: picked.assets[0].uri
                    })
                    await refreshDetail()
                  } catch (e) {
                    setError(String((e as Error)?.message || e))
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              {t('knowledge.upload_cover_image', '上传图片')}
            </Button>
            {coverImage ? (
              <Button variant="outlined" isDisabled={busy} onPress={() => void saveCover({ coverImage: '' })}>
                {t('knowledge.clear_cover_image', '清除图片')}
              </Button>
            ) : null}
          </View>

          {modelMismatch ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.bgSurface, borderColor: colors.error }
              ]}
            >
              <Text style={{ color: colors.error, fontWeight: '600' }}>
                {t('knowledge.model_mismatch_title', '嵌入模型不一致')}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {t(
                  'knowledge.model_mismatch_hard_block',
                  '提问已硬拦截。请重建索引后再问，否则答案会错得很像样。'
                )}
              </Text>
              <Button
                isDisabled={busy}
                onPress={() => {
                  void (async () => {
                    setBusy(true)
                    try {
                      await mobileRebuildKnowledgeIndex(notebookId)
                      setModelMismatch(await mobileHasKnowledgeModelMismatch([notebookId]))
                    } catch (e) {
                      setError(String((e as Error)?.message || e))
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                {t('knowledge.rebuild_index', '重建索引')}
              </Button>
            </View>
          ) : null}

          <View style={styles.rowGap}>
            <Button isDisabled={busy} onPress={() => setShowImport('text')}>
              {t('knowledge.import_text', '粘贴文本')}
            </Button>
            <Button isDisabled={busy} onPress={() => setShowImport('url')}>
              {t('knowledge.import_url', '导入 URL')}
            </Button>
          </View>

          {showImport === 'text' ? (
            <View style={{ marginBottom: 16 }}>
              <Input
                value={pasteTitle}
                onChangeText={setPasteTitle}
                placeholder={t('knowledge.source_title', '标题')}
              />
              <Input
                value={pasteText}
                onChangeText={setPasteText}
                placeholder={t('knowledge.source_body', '正文')}
                textarea
                multiline
                containerStyle={{ marginTop: 8, marginBottom: 10 }}
              />
              <Button isDisabled={busy || !pasteText.trim()} onPress={() => void onImportText()}>
                {t('knowledge.import_submit', '导入')}
              </Button>
            </View>
          ) : null}

          {showImport === 'url' ? (
            <View style={{ marginBottom: 16 }}>
              <Input
                value={urlValue}
                onChangeText={setUrlValue}
                placeholder="https://"
                autoCapitalize="none"
              />
              <Button isDisabled={busy || !urlValue.trim()} onPress={() => void onImportUrl()}>
                {t('knowledge.import_submit', '导入')}
              </Button>
            </View>
          ) : null}

          <Text style={[styles.section, { color: colors.textPrimary }]}>
            {t('knowledge.tab_sources', '资料')}
          </Text>
          {sources.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              {t('knowledge.empty_sources', '还没有资料，先导入 PDF / Markdown / URL。')}
            </Text>
          ) : (
            sources.map((s) => (
              <View key={s.id} style={[styles.sourceRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={{ color: colors.textPrimary, flex: 1 }}>{s.title}</Text>
                <View style={styles.sourceStatus}>
                  {s.status === 'failed' && s.errorMessage?.trim() ? (
                    <Tooltip content={s.errorMessage.trim()}>
                      <Text style={{ color: colors.textSecondary }}>
                        {knowledgeSourceStatusLabel(s.status, t)}
                      </Text>
                    </Tooltip>
                  ) : (
                    <Text style={{ color: colors.textSecondary }}>
                      {knowledgeSourceStatusLabel(s.status, t)}
                    </Text>
                  )}
                  {s.status === 'stored' ? (
                    <HelpTooltip
                      content={t(
                        'knowledge.status_stored_help',
                        '未整理之前，AI 无法使用这份资料。'
                      )}
                    />
                  ) : null}
                </View>
                <Button
                  isDisabled={busy}
                  destructive
                  onPress={() => void onDeleteSource(s)}
                >
                  {t('knowledge.delete_source', '删除')}
                </Button>
              </View>
            ))
          )}

          <Text style={[styles.section, { color: colors.textPrimary, marginTop: 20 }]}>
            {t('knowledge.graph_panel', '本笔记本图谱')}
          </Text>
          {graphNodes.length === 0 ? (
            <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
              {t('knowledge.graph_empty_title', '还没有开始整理这本笔记本的关系')}
            </Text>
          ) : (
            graphEdges.slice(0, 8).map((e) => {
              const from = graphNodes.find((n) => n.id === e.fromId)?.name || e.fromId.slice(0, 6)
              const to = graphNodes.find((n) => n.id === e.toId)?.name || e.toId.slice(0, 6)
              return (
                <Text key={e.id} style={{ color: colors.textSecondary, marginTop: 4 }}>
                  {from} —{e.edgeType}→ {to}
                </Text>
              )
            })
          )}

          <Text style={[styles.section, { color: colors.textPrimary, marginTop: 20 }]}>
            {t('knowledge.data_manage', '数据管理')}
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {t(
              'knowledge.data_manage_reprocess_intro',
              '勾选要按当前模型重新整理的数据。可能耗时较长。'
            )}
          </Text>
          <SegmentedControl
            value={manageAction}
            onChange={setManageAction}
            options={[
              { value: 'reprocess', label: t('knowledge.data_manage_reprocess', '重整理') },
              { value: 'clear', label: t('knowledge.data_manage_clear', '清除') }
            ]}
          />
          <View style={{ marginTop: 12, gap: 8 }}>
            <Pressable style={styles.checkRow} onPress={() => setManageVector((v) => !v)}>
              <Checkbox selected={manageVector} onPress={() => setManageVector((v) => !v)} />
              <Text style={{ color: colors.textPrimary }}>
                {t('knowledge.data_manage_vector', '向量片段')}
              </Text>
            </Pressable>
            <Pressable style={styles.checkRow} onPress={() => setManageGraph((v) => !v)}>
              <Checkbox selected={manageGraph} onPress={() => setManageGraph((v) => !v)} />
              <Text style={{ color: colors.textPrimary }}>
                {t('knowledge.data_manage_graph', '本笔记本图谱')}
              </Text>
            </Pressable>
          </View>
          {manageAction === 'clear' ? (
            <Input
              value={clearPhrase}
              onChangeText={setClearPhrase}
              placeholder={phrase}
              containerStyle={{ marginTop: 8 }}
            />
          ) : null}
          <View style={{ marginTop: 12 }}>
            <Button
              isDisabled={!canConfirm || busy}
              destructive={manageAction === 'clear'}
              onPress={() => {
                if (manageAction === 'clear') {
                  void dialog
                    .confirm(
                      t(
                        'knowledge.data_manage_clear_intro',
                        '勾选要清除的派生数据。原文还在，清除后不能恢复。'
                      ),
                      {
                        title: t('knowledge.data_manage_clear', '清除数据'),
                        confirmText: t('knowledge.data_manage_clear', '清除数据'),
                        cancelText: t('common.cancel', '取消')
                      }
                    )
                    .then((ok) => {
                      if (ok) void onManage()
                    })
                  return
                }
                void onManage()
              }}
            >
              {manageAction === 'clear'
                ? t('knowledge.data_manage_clear', '清除')
                : t('knowledge.data_manage_reprocess', '重整理')}
            </Button>
          </View>

          <Text style={[styles.mountHint, { color: colors.textSecondary }]}>
            {t('knowledge.mount_hint', '资料嵌入完成后，可以在软件内和 AI 对话时挂载。')}
          </Text>
          {error ? <Text style={{ color: colors.error, marginTop: 8 }}>{error}</Text> : null}
        </ScrollView>
      )}
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  coverPreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  coverImage: { width: 56, height: 56 },
  coverEmoji: { fontSize: 28 },
  h1: { fontSize: 22, fontWeight: '600', flex: 1 },
  section: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  mountHint: { fontSize: 13, lineHeight: 20, marginTop: 16, marginBottom: 8 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  sourceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    gap: 8
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  toneChip: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }
})
