import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNativeTheme } from '@baishou/ui/native'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  mobileExtractDiaries,
  mobileListPendingEdges,
  mobileListPendingReextract,
  mobileSearchGraphNodes,
  mobileSetEdgeReview
} from '@/src/services/mobile-graph.service'

type Tab = 'search' | 'reextract' | 'pending'

export function GraphScreen() {
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { services, dbReady } = useBaishou()
  const [tab, setTab] = useState<Tab>('reextract')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const vaultName = services?.vaultService.getActiveVault()?.name || 'Personal'

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
    setStatus('抽取中…')
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
      setStatus(`完成 ${result.done}，失败 ${result.failed}`)
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

  return (
    <View style={[styles.root, { backgroundColor: colors.bgApp, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.borderMuted }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>返回</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>关系图谱</Text>
        <Pressable disabled={busy} onPress={() => void runExtract()}>
          <Text style={{ color: busy ? colors.textSecondary : colors.primary, fontSize: 14 }}>
            梳理
          </Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {([
          ['reextract', `待重抽(${pending.length})`],
          ['pending', `待确认(${pendingEdges.length})`],
          ['search', '搜索']
        ] as const).map(([id, label]) => (
          <Pressable
            key={id}
            style={[
              styles.tab,
              tab === id && { backgroundColor: colors.bgSurface }
            ]}
            onPress={() => setTab(id)}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {status ? (
        <Text style={{ color: colors.textSecondary, paddingHorizontal: 16, marginBottom: 8 }}>
          {status}
        </Text>
      ) : null}
      {busy ? <ActivityIndicator color={colors.primary} style={{ marginBottom: 8 }} /> : null}

      {tab === 'search' && (
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索实体"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.textPrimary, borderColor: colors.borderMuted, backgroundColor: colors.bgSurface }
            ]}
            onSubmitEditing={() => void onSearch()}
          />
          <Pressable onPress={() => void onSearch()}>
            <Text style={{ color: colors.primary }}>搜索</Text>
          </Pressable>
        </View>
      )}

      {tab === 'search' && (
        <FlatList
          data={hits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary }}>输入关键词搜索图谱实体</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.bgSurface }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {item.nodeType}
                {item.summary ? ` · ${item.summary}` : ''}
              </Text>
            </View>
          )}
        />
      )}

      {tab === 'reextract' && (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.filePath}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary }}>暂无待重抽日记</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.bgSurface }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                {item.date || item.filePath}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{item.filePath}</Text>
              <View style={styles.row}>
                <Pressable disabled={busy} onPress={() => void runExtract([item.filePath])}>
                  <Text style={{ color: colors.primary }}>抽取</Text>
                </Pressable>
                {item.date ? (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/diary-editor', params: { dateStr: item.date } })
                    }
                  >
                    <Text style={{ color: colors.primary }}>原文</Text>
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
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary }}>没有待确认的边</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.bgSurface }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                {item.edgeType} · {item.confidence}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {item.sourceExcerpt || item.sourceRef || item.id}
              </Text>
              <View style={styles.row}>
                <Pressable onPress={() => void review(item.id, 'approved')}>
                  <Text style={{ color: colors.primary }}>通过</Text>
                </Pressable>
                <Pressable onPress={() => void review(item.id, 'rejected')}>
                  <Text style={{ color: colors.textSecondary }}>拒绝</Text>
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
                    <Text style={{ color: colors.primary }}>原文</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  title: { fontSize: 17, fontWeight: '650' },
  tabs: { flexDirection: 'row', gap: 8, padding: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10
  },
  card: { padding: 12, borderRadius: 10, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 16, marginTop: 10 }
})
