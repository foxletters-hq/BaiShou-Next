import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Input, useNativeTheme } from '@baishou/ui/native'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  mobileExtractDiaries,
  mobileListPendingEdges,
  mobileListPendingReextract,
  mobileLoadGlobalGraph,
  mobileSearchGraphNodes,
  mobileSetEdgeReview
} from '@/src/services/mobile-graph.service'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { GraphForceWebView } from './GraphForceWebView'

type Tab = 'graph' | 'search' | 'reextract' | 'pending'

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
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [graphNodes, setGraphNodes] = useState<any[]>([])
  const [graphEdges, setGraphEdges] = useState<any[]>([])
  const [selectedNode, setSelectedNode] = useState<{
    id: string
    name: string
    nodeType: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const vaultName = services?.vaultService.getActiveVault()?.name || 'Personal'

  const tabItems = useMemo(
    () =>
      [
        ['graph', t('graph.tab_graph', '图谱')],
        ['reextract', t('graph.tab_reextract', '待重抽({{count}})', { count: pending.length })],
        ['pending', t('graph.tab_pending', '待确认({{count}})', { count: pendingEdges.length })],
        ['search', t('graph.tab_search', '搜索')]
      ] as const,
    [t, pending.length, pendingEdges.length]
  )

  const refresh = useCallback(async () => {
    if (!services || !dbReady) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultName)
    setPending(
      await mobileListPendingReextract({
        vaultName,
        shadowRepo,
        pathService: services.pathService,
        fileSystem: services.fileSystem
      })
    )
    setPendingEdges(await mobileListPendingEdges(runtime.drizzleDb, vaultName))
    const graph = await mobileLoadGlobalGraph(runtime.drizzleDb, vaultName, 120)
    setGraphNodes(graph.nodes)
    setGraphEdges(graph.edges)
  }, [services, dbReady, vaultName])

  useEffect(() => {
    void refresh().catch((e) => setStatus(String(e?.message || e)))
  }, [refresh])

  const onSearch = async () => {
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb || !query.trim()) {
      setHits([])
      return
    }
    setHits(await mobileSearchGraphNodes(runtime.drizzleDb, vaultName, query.trim()))
  }

  const runExtract = async (filePaths?: string[]) => {
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    setBusy(true)
    setStatus(t('graph.extracting', '抽取中…'))
    try {
      const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultName)
      const result = await mobileExtractDiaries({
        vaultName,
        drizzleDb: runtime.drizzleDb,
        shadowRepo,
        pathService: services.pathService,
        fileSystem: services.fileSystem,
        settingsManager: services.settingsManager,
        filePaths
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

  const review = async (edgeId: string, reviewStatus: 'approved' | 'rejected') => {
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    await mobileSetEdgeReview({
      drizzleDb: runtime.drizzleDb,
      pathService: services.pathService,
      fileSystem: services.fileSystem,
      edgeId,
      reviewStatus
    })
    await refresh()
  }

  const listPad = {
    padding: 16,
    paddingBottom: 16 + insets.bottom
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
              <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>
                {selectedNode.name}
              </Text>
              <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                {selectedNode.nodeType}
              </Text>
            </View>
          ) : null}
          {graphNodes.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {t('graph.empty_nodes', '暂无图谱节点；可先梳理日记或在桌面写入关系。')}
            </Text>
          ) : (
            <View style={[styles.webWrap, { backgroundColor: colors.bgApp }]}>
              <GraphForceWebView
                nodes={graphNodes.map((n) => ({
                  id: n.id,
                  name: n.name,
                  nodeType: n.nodeType,
                  mentionCount: n.mentionCount
                }))}
                edges={graphEdges.map((e) => ({
                  id: e.id,
                  fromId: e.fromId,
                  toId: e.toId,
                  edgeType: e.edgeType
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
              <View
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
              </View>
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
          data={pendingEdges}
          keyExtractor={(item) => item.id}
          contentContainerStyle={listPad}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary }}>
              {t('graph.pending_empty', '没有待确认的边')}
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
                {item.edgeType} · {item.confidence}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {item.sourceExcerpt || item.sourceRef || item.id}
              </Text>
              <View style={styles.row}>
                <Pressable onPress={() => void review(item.id, 'approved')}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {t('graph.approve', '通过')}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void review(item.id, 'rejected')}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                    {t('graph.reject', '拒绝')}
                  </Text>
                </Pressable>
                {item.sourceRef ? (
                  <Pressable
                    onPress={() => {
                      const m = String(item.sourceRef).match(/(\d{4}-\d{2}-\d{2})/)
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
  detailBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  detailMeta: {
    fontSize: 12
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
    marginTop: 10
  }
})
