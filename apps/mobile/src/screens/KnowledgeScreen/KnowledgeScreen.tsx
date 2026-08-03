import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import {
  mobileAskKnowledge,
  mobileGetKnowledgeStats,
  mobileHasKnowledgeModelMismatch,
  mobileImportSource,
  mobileListNotebooks,
  mobileListSources,
  mobileRebuildKnowledgeIndex,
  mobileSaveAskAsNote
} from '@/src/services/mobile-knowledge.service'
import { scheduleConsumeMobileKnowledgeIngestJobs } from '@/src/services/mobile-knowledge-ingest-jobs.consumer'

type NotebookRow = {
  id: string
  name: string
  description?: string
}

type SourceRow = {
  id: string
  title: string
  status: string
  errorMessage?: string | null
}

type NotebookStats = {
  sources: number
  chunks: number
  pendingJobs: number
  originalBytes: number
  totalBytes: number
}

function formatMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0'
  return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)
}

function statusLabel(status: string, t: (k: string, f: string) => string): string {
  const map: Record<string, [string, string]> = {
    pending: ['knowledge.status_pending', '等待中'],
    extracting: ['knowledge.status_extracting', '提取中'],
    needs_ocr: ['knowledge.status_needs_ocr', '需 OCR'],
    partial: ['knowledge.status_partial', '部分文本'],
    embedding: ['knowledge.status_embedding', '索引中'],
    ready: ['knowledge.status_ready', '就绪'],
    failed: ['knowledge.status_failed', '失败']
  }
  const entry = map[status]
  return entry ? t(entry[0], entry[1]) : status
}

export function KnowledgeScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const { dbReady } = useBaishou()

  const [notebooks, setNotebooks] = useState<NotebookRow[]>([])
  const [statsById, setStatsById] = useState<Record<string, NotebookStats>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState<
    Array<{ title: string; excerpt: string; page?: number }>
  >([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modelMismatch, setModelMismatch] = useState(false)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [showImport, setShowImport] = useState<'text' | 'url' | null>(null)

  const refreshList = useCallback(async () => {
    const list = (await mobileListNotebooks()) as NotebookRow[]
    setNotebooks(list || [])
    const next: Record<string, NotebookStats> = {}
    await Promise.all(
      (list || []).map(async (nb) => {
        try {
          const stats = await mobileGetKnowledgeStats(nb.id)
          next[nb.id] = {
            sources: stats.sources,
            chunks: stats.chunks,
            pendingJobs: stats.pendingJobs,
            originalBytes: stats.originalBytes ?? 0,
            totalBytes: stats.totalBytes ?? 0
          }
        } catch {
          next[nb.id] = {
            sources: 0,
            chunks: 0,
            pendingJobs: 0,
            originalBytes: 0,
            totalBytes: 0
          }
        }
      })
    )
    setStatsById(next)
    try {
      setModelMismatch(await mobileHasKnowledgeModelMismatch())
    } catch {
      setModelMismatch(false)
    }
  }, [])

  const refreshDetail = useCallback(async (notebookId: string) => {
    const list = (await mobileListSources(notebookId)) as SourceRow[]
    setSources(list || [])
  }, [])

  useEffect(() => {
    if (!dbReady) return
    void refreshList().catch((e) => setError(String((e as Error)?.message || e)))
    scheduleConsumeMobileKnowledgeIngestJobs('knowledge-screen-open')
  }, [dbReady, refreshList])

  useEffect(() => {
    if (!selectedId) return
    void refreshDetail(selectedId).catch(() => undefined)
    const timer = setInterval(() => {
      void refreshDetail(selectedId).catch(() => undefined)
    }, 4000)
    return () => clearInterval(timer)
  }, [selectedId, refreshDetail])

  const onAsk = async () => {
    const q = question.trim()
    if (!q || !selectedId) return

    if (modelMismatch) {
      Alert.alert(
        t('knowledge.model_mismatch_title', '嵌入模型不一致'),
        t(
          'knowledge.model_mismatch_desc',
          '当前嵌入模型与知识库向量不一致，继续提问会得到错误结果。请先重建本笔记本索引。'
        ),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('knowledge.rebuild_index', '重建索引'),
            onPress: () => {
              void (async () => {
                setBusy(true)
                try {
                  await mobileRebuildKnowledgeIndex(selectedId)
                  setModelMismatch(await mobileHasKnowledgeModelMismatch())
                  setError('')
                  Alert.alert(
                    t('knowledge.rebuild_queued', '已排队重建'),
                    t('knowledge.rebuild_queued_desc', '索引完成后即可提问。')
                  )
                } catch (e) {
                  setError(String((e as Error)?.message || e))
                } finally {
                  setBusy(false)
                }
              })()
            }
          }
        ]
      )
      return
    }

    setBusy(true)
    setError('')
    setAnswer('')
    setCitations([])
    try {
      const result = await mobileAskKnowledge({ notebookId: selectedId, question: q })
      setAnswer(result.answer)
      setCitations(
        (result.citations || []).map((c) => ({
          title: c.title,
          excerpt: c.excerpt,
          page: c.page
        }))
      )
    } catch (e) {
      const msg = String((e as Error)?.message || e)
      if (msg === 'knowledge-model-mismatch') {
        setModelMismatch(true)
        setError(
          t(
            'knowledge.model_mismatch_desc',
            '当前嵌入模型与知识库向量不一致，继续提问会得到错误结果。请先重建本笔记本索引。'
          )
        )
      } else if (msg === 'embedding-not-configured') {
        setError(t('knowledge.embedding_required', '请先配置嵌入模型后再提问。'))
      } else {
        setError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const onImportText = async () => {
    if (!selectedId || !pasteText.trim()) return
    setBusy(true)
    setError('')
    try {
      await mobileImportSource({
        notebookId: selectedId,
        title: pasteTitle.trim() || t('knowledge.pasted_text', '粘贴文本'),
        kind: 'text',
        textContent: pasteText
      })
      setPasteTitle('')
      setPasteText('')
      setShowImport(null)
      await refreshDetail(selectedId)
      await refreshList()
      Alert.alert(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportUrl = async () => {
    const originUrl = urlValue.trim()
    if (!selectedId || !originUrl) return
    setBusy(true)
    setError('')
    try {
      await mobileImportSource({
        notebookId: selectedId,
        title: '',
        kind: 'url',
        originUrl
      })
      setUrlValue('')
      setShowImport(null)
      await refreshDetail(selectedId)
      await refreshList()
      Alert.alert(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onSaveNote = async () => {
    if (!selectedId || !answer.trim() || !question.trim()) return
    setBusy(true)
    try {
      await mobileSaveAskAsNote({
        notebookId: selectedId,
        question: question.trim(),
        answer: answer.trim(),
        citations: citations.map((c) => ({
          title: c.title,
          page: c.page,
          excerpt: c.excerpt
        }))
      })
      await refreshDetail(selectedId)
      Alert.alert(t('knowledge.note_saved', '已保存为 Note，并加入索引队列'))
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const selected = notebooks.find((n) => n.id === selectedId)
  const selectedStats = selectedId ? statsById[selectedId] : null

  return (
    <StackScreenLayout
      title={t('knowledge.title', '知识库')}
      {...chrome}
      onBack={() => (selectedId ? setSelectedId(null) : router.back())}
      contentStyle={{ flex: 1 }}
    >
      {!dbReady ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : selectedId && selected ? (
        <ScrollView
          contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.h1, { color: colors.textPrimary }]}>{selected.name}</Text>
          {selectedStats ? (
            <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
              {t('knowledge.storage_usage', '本笔记本 {{total}} MB，其中原文 {{original}} MB', {
                total: formatMb(selectedStats.totalBytes),
                original: formatMb(selectedStats.originalBytes)
              })}
              {selectedStats.pendingJobs > 0
                ? ` · ${t('knowledge.indexing', '索引中')} ${selectedStats.pendingJobs}`
                : ''}
            </Text>
          ) : null}

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
              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary, marginTop: 8 }]}
                disabled={busy}
                onPress={() => {
                  void (async () => {
                    setBusy(true)
                    try {
                      await mobileRebuildKnowledgeIndex(selectedId)
                      setModelMismatch(await mobileHasKnowledgeModelMismatch())
                    } catch (e) {
                      setError(String((e as Error)?.message || e))
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                <Text style={styles.btnText}>{t('knowledge.rebuild_index', '重建索引')}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.primary, paddingHorizontal: 12 }]}
              disabled={busy}
              onPress={() => setShowImport('text')}
            >
              <Text style={styles.btnText}>{t('knowledge.import_text', '粘贴文本')}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.primary, paddingHorizontal: 12 }]}
              disabled={busy}
              onPress={() => setShowImport('url')}
            >
              <Text style={styles.btnText}>{t('knowledge.import_url', '导入 URL')}</Text>
            </Pressable>
          </View>

          {showImport === 'text' ? (
            <View style={{ marginBottom: 16 }}>
              <TextInput
                value={pasteTitle}
                onChangeText={setPasteTitle}
                placeholder={t('knowledge.source_title', '标题')}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  {
                    minHeight: 40,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                    backgroundColor: colors.bgSurface
                  }
                ]}
              />
              <TextInput
                value={pasteText}
                onChangeText={setPasteText}
                placeholder={t('knowledge.source_body', '正文')}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                    backgroundColor: colors.bgSurface
                  }
                ]}
                multiline
              />
              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary }]}
                disabled={busy || !pasteText.trim()}
                onPress={() => void onImportText()}
              >
                <Text style={styles.btnText}>{t('knowledge.import_submit', '导入')}</Text>
              </Pressable>
            </View>
          ) : null}

          {showImport === 'url' ? (
            <View style={{ marginBottom: 16 }}>
              <TextInput
                value={urlValue}
                onChangeText={setUrlValue}
                placeholder="https://"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    minHeight: 40,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                    backgroundColor: colors.bgSurface
                  }
                ]}
              />
              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary }]}
                disabled={busy || !urlValue.trim()}
                onPress={() => void onImportUrl()}
              >
                <Text style={styles.btnText}>{t('knowledge.import_submit', '导入')}</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={[styles.section, { color: colors.textPrimary }]}>
            {t('knowledge.sources', '资料')}
          </Text>
          {sources.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              {t(
                'knowledge.empty_sources_mobile',
                '暂无资料。可粘贴文本 / 导入 URL，或在桌面端导入后同步。'
              )}
            </Text>
          ) : (
            sources.map((s) => (
              <View
                key={s.id}
                style={[styles.sourceRow, { borderBottomColor: colors.borderSubtle }]}
              >
                <Text style={{ color: colors.textPrimary, flex: 1 }}>{s.title}</Text>
                <Text style={{ color: colors.textSecondary }}>
                  {statusLabel(s.status, t)}
                </Text>
              </View>
            ))
          )}

          <Text style={[styles.section, { color: colors.textPrimary, marginTop: 20 }]}>
            {t('knowledge.ask', '提问')}
          </Text>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder={t('knowledge.ask_placeholder', '问这本笔记本里的资料…')}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
                backgroundColor: colors.bgSurface
              }
            ]}
            multiline
          />
          <Pressable
            style={[
              styles.btn,
              {
                backgroundColor: modelMismatch ? colors.borderSubtle : colors.primary,
                opacity: busy || !question.trim() ? 0.6 : 1
              }
            ]}
            disabled={busy || !question.trim()}
            onPress={() => void onAsk()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t('knowledge.ask_action', '提问')}</Text>
            )}
          </Pressable>

          {error ? <Text style={{ color: colors.error, marginTop: 8 }}>{error}</Text> : null}
          {answer ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.section, { color: colors.textPrimary }]}>
                {t('knowledge.answer', '回答')}
              </Text>
              <Text style={{ color: colors.textPrimary, lineHeight: 22 }}>{answer}</Text>
              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary, marginTop: 10 }]}
                disabled={busy}
                onPress={() => void onSaveNote()}
              >
                <Text style={styles.btnText}>{t('knowledge.save_note', '保存为 Note')}</Text>
              </Pressable>
              {citations.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.section, { color: colors.textPrimary }]}>
                    {t('knowledge.citations', '引用')}
                  </Text>
                  {citations.map((c, i) => (
                    <View key={`${c.title}-${i}`} style={{ marginBottom: 8 }}>
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>
                        [{i + 1}] {c.title}
                        {c.page != null ? ` · p.${c.page}` : ''}
                      </Text>
                      <Text style={{ color: colors.textSecondary }}>{c.excerpt}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
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
            error ? (
              <Text style={{ color: colors.error, marginBottom: 8 }}>{error}</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const stats = statsById[item.id]
            return (
              <Pressable
                onPress={() => setSelectedId(item.id)}
                style={[
                  styles.card,
                  { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
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
                        total: formatMb(stats.totalBytes),
                        original: formatMb(stats.originalBytes)
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
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  section: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10
  },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  input: {
    minHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
    marginBottom: 10
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  btnText: { color: '#fff', fontWeight: '600' },
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  }
})
