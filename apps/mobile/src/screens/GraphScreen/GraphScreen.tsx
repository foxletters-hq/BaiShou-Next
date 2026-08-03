import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Switch
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Input, useNativeTheme } from '@baishou/ui/native'
import { deriveLegacyVaultId } from '@baishou/shared'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  mobileEstimateExtraction,
  mobileExtractDiaries,
  mobileListPending,
  mobileListPendingReextract,
  mobileLoadGlobalGraph,
  mobileSearchGraphNodes,
  mobileSetEdgeReview,
  mobileSetNodeReview,
  mobileSoftDeleteGraph,
  mobileUpsertNode
} from '@/src/services/mobile-graph.service'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { GraphForceWebView } from './GraphForceWebView'

type Tab = 'graph' | 'search' | 'reextract' | 'pending'

type CostEstimate = {
  entryCount: number
  estimatedTokens: number
  estimatedYuanLow: number
  estimatedYuanHigh: number
  estimatedMinutesLow: number
  estimatedMinutesHigh: number
}

type PendingItem =
  | { kind: 'node'; id: string; data: any }
  | { kind: 'edge'; id: string; data: any }

export function GraphScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const { services, dbReady } = useBaishou()
  const [tab, setTab] = useState<Tab>('graph')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [pendingNodes, setPendingNodes] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [graphNodes, setGraphNodes] = useState<any[]>([])
  const [graphEdges, setGraphEdges] = useState<any[]>([])
  const [selectedNode, setSelectedNode] = useState<{
    id: string
    name: string
    nodeType: string
    reviewStatus?: string
  } | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [dismissGuide, setDismissGuide] = useState(false)
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)

  const activeVault = services?.vaultService.getActiveVault()
  const vaultName = activeVault?.name || 'Personal'
  const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)

  const pendingItems: PendingItem[] = useMemo(
    () => [
      ...pendingNodes.map((n) => ({ kind: 'node' as const, id: n.id, data: n })),
      ...pendingEdges.map((e) => ({ kind: 'edge' as const, id: e.id, data: e }))
    ],
    [pendingNodes, pendingEdges]
  )

  const tabItems = useMemo(
    () =>
      [
        ['graph', t('graph.tab_graph', '图谱')],
        [
          'reextract',
          `${t('graph.tab_reextract', '待重抽')}(${pending.length})`
        ],
        [
          'pending',
          `${t('graph.tab_pending', '待确认')}(${pendingItems.length})`
        ],
        ['search', t('graph.tab_search', '搜索')]
      ] as const,
    [t, pending.length, pendingItems.length]
  )

  const refresh = useCallback(async () => {
    if (!services || !dbReady) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId)
    setPending(
      await mobileListPendingReextract({
        vaultName,
        shadowRepo,
        pathService: services.pathService,
        fileSystem: services.fileSystem
      })
    )
    const pendingBundle = await mobileListPending(runtime.drizzleDb, vaultId)
    setPendingNodes(pendingBundle.nodes)
    setPendingEdges(pendingBundle.edges)
    const graph = await mobileLoadGlobalGraph(runtime.drizzleDb, vaultId, 120)
    setGraphNodes(graph.nodes)
    setGraphEdges(graph.edges)
    try {
      setEstimate(
        await mobileEstimateExtraction({
          vaultName,
          shadowRepo,
          pathService: services.pathService,
          fileSystem: services.fileSystem
        })
      )
    } catch {
      setEstimate(null)
    }
  }, [services, dbReady, vaultName, vaultId])

  useEffect(() => {
    void refresh().catch((e) => setStatus(String(e?.message || e)))
  }, [refresh])

  useEffect(() => {
    if (selectedNode) setEditName(selectedNode.name)
  }, [selectedNode])

  const displayNodes = useMemo(
    () =>
      graphNodes.filter((n) => {
        if (n.reviewStatus === 'rejected') return false
        if (approvedOnly && n.reviewStatus === 'pending') return false
        return true
      }),
    [graphNodes, approvedOnly]
  )

  const displayEdges = useMemo(() => {
    const idSet = new Set(displayNodes.map((n) => n.id))
    return graphEdges.filter((e) => {
      if (e.reviewStatus === 'rejected') return false
      if (approvedOnly && e.reviewStatus === 'pending') return false
      return idSet.has(e.fromId) && idSet.has(e.toId)
    })
  }, [graphEdges, displayNodes, approvedOnly])

  const showEmptyGuide =
    !dismissGuide &&
    displayNodes.length === 0 &&
    (estimate?.entryCount ?? pending.length) > 0

  const onSearch = async () => {
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb || !query.trim()) {
      setHits([])
      return
    }
    setHits(await mobileSearchGraphNodes(runtime.drizzleDb, vaultId, query.trim()))
  }

  const runExtract = async (filePaths?: string[]) => {
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    setBusy(true)
    setDismissGuide(true)
    setStatus(t('graph.extracting', '抽取中…'))
    try {
      const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId)
      const result = await mobileExtractDiaries({
        vaultId,
        vaultName,
        drizzleDb: runtime.drizzleDb,
        shadowRepo,
        pathService: services.pathService,
        fileSystem: services.fileSystem,
        settingsManager: services.settingsManager,
        filePaths,
        onProgress: (p) => {
          setStatus(
            t('graph.extract_progress', '正在整理 {{current}}/{{total}}', {
              current: p.current,
              total: p.total
            })
          )
        }
      })
      setStatus(
        t('graph.extract_done', '完成 {{done}}，失败 {{failed}}', {
          done: result.done,
          failed: result.failed
        })
      )
      await refresh()
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const reviewEdge = async (edgeId: string, reviewStatus: 'approved' | 'rejected') => {
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    await mobileSetEdgeReview({
      drizzleDb: runtime.drizzleDb,
      pathService: services.pathService,
      fileSystem: services.fileSystem,
      edgeId,
      reviewStatus,
      vaultDisplayName: vaultName
    })
    await refresh()
  }

  const reviewNode = async (nodeId: string, reviewStatus: 'approved' | 'rejected') => {
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    await mobileSetNodeReview({
      drizzleDb: runtime.drizzleDb,
      pathService: services.pathService,
      fileSystem: services.fileSystem,
      nodeId,
      reviewStatus,
      vaultDisplayName: vaultName
    })
    await refresh()
  }

  const saveRename = async () => {
    if (!services || !selectedNode) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const name = editName.trim()
    if (!name) return
    setBusy(true)
    try {
      await mobileUpsertNode({
        drizzleDb: runtime.drizzleDb,
        pathService: services.pathService,
        fileSystem: services.fileSystem,
        vaultId,
        vaultDisplayName: vaultName,
        id: selectedNode.id,
        name,
        nodeType: selectedNode.nodeType
      })
      setSelectedNode({ ...selectedNode, name })
      setStatus(t('graph.edit_saved', '已保存（手工修正，重抽不会覆盖）'))
      await refresh()
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = () => {
    if (!selectedNode) return
    Alert.alert(
      t('graph.delete_node', '删除节点'),
      t('graph.confirm_delete_node', '确定删除该节点？相关边也会一并软删。'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.delete', '删除'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!services) return
              const runtime = getAgentDbRuntime()
              if (!runtime?.drizzleDb) return
              setBusy(true)
              try {
                await mobileSoftDeleteGraph({
                  drizzleDb: runtime.drizzleDb,
                  pathService: services.pathService,
                  fileSystem: services.fileSystem,
                  kind: 'node',
                  id: selectedNode.id
                })
                setSelectedNode(null)
                await refresh()
              } catch (e: any) {
                setStatus(e?.message || String(e))
              } finally {
                setBusy(false)
              }
            })()
          }
        }
      ]
    )
  }

  const listPad = {
    padding: 16,
    paddingBottom: 16 + insets.bottom
  }

  const formatTokens = (n: number) => {
    if (n >= 10000) return t('graph.tokens_wan', '约 {{n}} 万', { n: (n / 10000).toFixed(1) })
    return t('graph.tokens_count', '约 {{n}}', { n })
  }

  return (
    <StackScreenLayout
      title={t('graph.title', '关系图谱')}
      {...chrome}
      headerRight={{
        label: t('graph.extract', '梳理'),
        onPress: () => void runExtract(),
        disabled: busy
      }}
      contentStyle={styles.layoutContent}
    >
      <View style={[styles.tabTrack, { backgroundColor: colors.bgSurfaceNormal }]}>
        {tabItems.map(([id, label]) => {
          const active = tab === id
          return (
            <Pressable
              key={id}
              style={[
                styles.tab,
                active && {
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderMuted
                }
              ]}
              onPress={() => setTab(id)}
            >
              <Text
                style={{
                  color: active ? colors.primary : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: active ? '600' : '500'
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {status ? (
        <Text style={[styles.status, { color: colors.textSecondary }]}>{status}</Text>
      ) : null}
      {busy ? <ActivityIndicator color={colors.primary} style={{ marginBottom: 8 }} /> : null}

      {tab === 'graph' && (
        <View style={[styles.graphBody, { paddingBottom: insets.bottom }]}>
          <View style={styles.switchRow}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t('graph.approved_only', '只看已确认')}
            </Text>
            <Switch value={approvedOnly} onValueChange={setApprovedOnly} />
          </View>
          {selectedNode ? (
            <View
              style={[
                styles.detailBar,
                {
                  backgroundColor: colors.bgSurface,
                  borderBottomColor: colors.borderSubtle
                }
              ]}
            >
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={[styles.renameInput, { color: colors.textPrimary, borderColor: colors.borderSubtle }]}
              />
              <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                {selectedNode.nodeType}
                {selectedNode.reviewStatus === 'pending'
                  ? ` · ${t('graph.pending_badge', '待确认')}`
                  : ''}
              </Text>
              <View style={styles.row}>
                <Pressable disabled={busy} onPress={() => void saveRename()}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {t('graph.save_edit', '保存修改')}
                  </Text>
                </Pressable>
                {selectedNode.reviewStatus === 'pending' ? (
                  <>
                    <Pressable onPress={() => void reviewNode(selectedNode.id, 'approved')}>
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>
                        {t('graph.approve', '通过')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void reviewNode(selectedNode.id, 'rejected')}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                        {t('graph.reject', '拒绝')}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
                <Pressable onPress={deleteSelected}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                    {t('graph.delete_node', '删除')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {showEmptyGuide ? (
            <View style={styles.guide}>
              <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
                {t('graph.empty_guide_title', '还没有开始整理你的关系图谱')}
              </Text>
              <Text style={[styles.guideBody, { color: colors.textSecondary }]}>
                {t(
                  'graph.empty_guide_body',
                  '发现 {{count}} 篇日记可以分析，预计消耗 {{tokens}} tokens（约 ¥{{yuanLow}}–{{yuanHigh}}），用时约 {{minLow}}–{{minHigh}} 分钟。',
                  {
                    count: estimate?.entryCount ?? pending.length,
                    tokens: formatTokens(estimate?.estimatedTokens ?? 0),
                    yuanLow: estimate?.estimatedYuanLow ?? 0,
                    yuanHigh: estimate?.estimatedYuanHigh ?? 0,
                    minLow: estimate?.estimatedMinutesLow ?? 1,
                    minHigh: estimate?.estimatedMinutesHigh ?? 1
                  }
                )}
              </Text>
              <View style={styles.row}>
                <Pressable disabled={busy} onPress={() => void runExtract()}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>
                    {t('graph.start_organize', '开始整理')}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setDismissGuide(true)}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                    {t('graph.later', '以后再说')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : displayNodes.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {t('graph.empty_nodes', '暂无图谱节点；可先梳理日记或在桌面写入关系。')}
            </Text>
          ) : (
            <View style={[styles.webWrap, { backgroundColor: colors.bgApp }]}>
              <GraphForceWebView
                nodes={displayNodes.map((n) => ({
                  id: n.id,
                  name: n.name,
                  nodeType: n.nodeType,
                  mentionCount: n.mentionCount,
                  reviewStatus: n.reviewStatus
                }))}
                edges={displayEdges.map((e) => ({
                  id: e.id,
                  fromId: e.fromId,
                  toId: e.toId,
                  edgeType: e.edgeType,
                  reviewStatus: e.reviewStatus
                }))}
                onSelectNode={setSelectedNode}
              />
            </View>
          )}
        </View>
      )}

      {tab === 'search' && (
        <>
          <View style={styles.searchRow}>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t('graph.search_placeholder', '搜索实体')}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => void onSearch()}
              containerStyle={{ flex: 1 }}
            />
            <Pressable onPress={() => void onSearch()} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {t('common.search', '搜索')}
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={hits}
            keyExtractor={(item) => item.id}
            contentContainerStyle={listPad}
            ListEmptyComponent={
              <Text style={{ color: colors.textSecondary }}>
                {t('graph.search_empty', '输入关键词搜索图谱实体')}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelectedNode({
                    id: item.id,
                    name: item.name,
                    nodeType: item.nodeType,
                    reviewStatus: item.reviewStatus
                  })
                  setTab('graph')
                }}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle
                  }
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {item.nodeType}
                  {item.summary ? ` · ${item.summary}` : ''}
                </Text>
              </Pressable>
            )}
          />
        </>
      )}

      {tab === 'reextract' && (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.filePath}
          contentContainerStyle={listPad}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary }}>
              {t('graph.reextract_empty', '暂无待重抽日记')}
            </Text>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle
                }
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {item.date || item.filePath}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {item.filePath}
              </Text>
              <View style={styles.row}>
                <Pressable disabled={busy} onPress={() => void runExtract([item.filePath])}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {t('graph.extract_one', '抽取')}
                  </Text>
                </Pressable>
                {item.date ? (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/diary-editor', params: { dateStr: item.date } })
                    }
                  >
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>
                      {t('graph.open_source', '原文')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />
      )}

      {tab === 'pending' && (
        <FlatList
          data={pendingItems}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={listPad}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary }}>
              {t('graph.no_pending', '没有待确认的节点或边')}
            </Text>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle
                }
              ]}
            >
              {item.kind === 'node' ? (
                <>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    {t('graph.pending_node', '节点')} · {item.data.name}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {item.data.nodeType}
                    {item.data.summary ? ` · ${item.data.summary}` : ''}
                  </Text>
                  <View style={styles.row}>
                    <Pressable onPress={() => void reviewNode(item.id, 'approved')}>
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>
                        {t('graph.approve', '通过')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void reviewNode(item.id, 'rejected')}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                        {t('graph.reject', '拒绝')}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    {t('graph.pending_edge', '关系')} · {item.data.edgeType} · {item.data.confidence}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {item.data.sourceExcerpt || item.data.sourceRef || item.data.id}
                  </Text>
                  <View style={styles.row}>
                    <Pressable onPress={() => void reviewEdge(item.id, 'approved')}>
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>
                        {t('graph.approve', '通过')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void reviewEdge(item.id, 'rejected')}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                        {t('graph.reject', '拒绝')}
                      </Text>
                    </Pressable>
                    {item.data.sourceRef ? (
                      <Pressable
                        onPress={() => {
                          const m = String(item.data.sourceRef).match(/(\d{4}-\d{2}-\d{2})/)
                          if (m) {
                            router.push({ pathname: '/diary-editor', params: { dateStr: m[1] } })
                          }
                        }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>
                          {t('graph.open_source', '原文')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </>
              )}
            </View>
          )}
        />
      )}
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: {
    flex: 1
  },
  tabTrack: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    padding: 4,
    borderRadius: 12
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent'
  },
  status: {
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 13
  },
  graphBody: {
    flex: 1
  },
  webWrap: {
    flex: 1
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6
  },
  detailBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6
  },
  renameInput: {
    fontSize: 14,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  detailMeta: {
    fontSize: 12
  },
  guide: {
    padding: 24,
    gap: 12
  },
  guideTitle: {
    fontSize: 17,
    fontWeight: '700'
  },
  guideBody: {
    fontSize: 14,
    lineHeight: 22
  },
  empty: {
    padding: 16,
    fontSize: 13,
    lineHeight: 20
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  card: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    flexWrap: 'wrap'
  }
})
