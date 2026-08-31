import React, { useEffect, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { asGraphTranslateFn, translateGraphNodeType } from '@baishou/shared'
import { FloatingModal, useNativeTheme } from '@baishou/ui/native'
import type { AppDatabase } from '@baishou/database'
import { mobileSearchGraphNodes } from '@/src/services/mobile-graph.service'
import type { GraphMergeConfirmTarget } from './GraphIrreversibleConfirm'

export type GraphMergePick = {
  id: string
  name: string
  nodeType: string
}

export function GraphMergeSearchSheet(props: {
  visible: boolean
  drizzleDb: AppDatabase | null
  vaultId: string
  seed: GraphMergePick | null
  busy?: boolean
  onClose: () => void
  onRequestMerge: (target: GraphMergeConfirmTarget) => void
}) {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  const { colors } = useNativeTheme()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<GraphMergePick[]>([])
  const [picks, setPicks] = useState<GraphMergePick[]>([])
  const [survivorId, setSurvivorId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!props.visible) return
    const start =
      props.seed && props.seed.nodeType !== 'entry'
        ? [{ id: props.seed.id, name: props.seed.name, nodeType: props.seed.nodeType }]
        : []
    setQuery('')
    setHits([])
    setPicks(start)
    setSurvivorId(start[0]?.id ?? null)
    setError('')
    setSearching(false)
    setSearched(false)
    // 只在打开时带入当前选中节点，搜索过程中不要被父组件重渲染清空。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible])

  const search = async (raw = query) => {
    const q = raw.trim()
    if (!q || !props.drizzleDb) {
      setHits([])
      setSearched(false)
      return
    }
    setSearching(true)
    try {
      const nodeType = picks[0]?.nodeType
      const found = await mobileSearchGraphNodes(props.drizzleDb, props.vaultId, q)
      const picked = new Set(picks.map((p) => p.id))
      setHits(
        found
          .filter(
            (n) =>
              n?.id &&
              !picked.has(n.id) &&
              n.nodeType !== 'entry' &&
              n.reviewStatus !== 'rejected' &&
              (!nodeType || n.nodeType === nodeType)
          )
          .slice(0, 20)
          .map((n) => ({ id: n.id, name: n.name, nodeType: n.nodeType }))
      )
      setSearched(true)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (!props.visible) return
    const q = query.trim()
    if (!q) {
      setHits([])
      setSearched(false)
      return
    }
    const timer = setTimeout(() => {
      void search(q)
    }, 280)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible, query, picks])

  const addPick = (hit: GraphMergePick) => {
    if (hit.nodeType === 'entry') {
      setError(t('graph.merge_entry_forbidden', '日记锚点不能合并'))
      return
    }
    const first = picks[0]
    if (first && first.nodeType !== hit.nodeType) {
      setError(t('graph.merge_type_mismatch', '只能选择同一类型的节点合并'))
      return
    }
    setError('')
    setPicks((prev) => (prev.some((p) => p.id === hit.id) ? prev : [...prev, hit]))
    setSurvivorId((cur) => cur ?? hit.id)
    setHits((prev) => prev.filter((h) => h.id !== hit.id))
  }

  const removePick = (id: string) => {
    setPicks((prev) => {
      const next = prev.filter((p) => p.id !== id)
      setSurvivorId((cur) => (cur === id ? (next[0]?.id ?? null) : cur))
      return next
    })
  }

  const submit = () => {
    if (!survivorId || picks.length < 2) return
    const survivor = picks.find((p) => p.id === survivorId)
    if (!survivor) return
    props.onRequestMerge({
      survivorId: survivor.id,
      survivorName: survivor.name,
      losers: picks.filter((p) => p.id !== survivor.id).map((p) => ({ id: p.id, name: p.name }))
    })
  }

  const typeLock = picks[0]?.nodeType
  const canMerge = !props.busy && picks.length >= 2 && Boolean(survivorId)

  return (
    <FloatingModal
      visible={props.visible}
      onClose={props.onClose}
      closeOnBackdropPress={!props.busy}
      maxWidth={420}
    >
      <View style={sheet.titleBlock}>
        <Text style={[sheet.title, { color: colors.textPrimary }]}>
          {t('graph.merge_nodes', '合并节点')}
        </Text>
        <Text style={[sheet.lead, { color: colors.textSecondary }]}>
          {t('graph.merge_search_hint', '当前选中的节点会保留。搜索并加入要合并进来的节点，不需要的可以移出。')}
        </Text>
      </View>

      <View
        style={[
          sheet.searchField,
          { borderColor: colors.borderControl, backgroundColor: colors.bgSurface }
        ]}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('graph.merge_search_placeholder', '搜索节点名称')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void search()}
          style={[sheet.searchInput, { color: colors.textPrimary }]}
        />
        <Pressable
          onPress={() => void search()}
          disabled={searching}
          style={[sheet.searchBtn, { borderLeftColor: colors.borderMuted }]}
        >
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
            {t('graph.search', '搜索')}
          </Text>
        </Pressable>
      </View>
      {typeLock ? (
        <Text style={[sheet.meta, { color: colors.textSecondary }]}>
          {t('graph.merge_search_type_lock', '仅搜索「{{type}}」', {
            type: translateGraphNodeType(tr, typeLock)
          })}
        </Text>
      ) : null}

      {searched || searching ? (
        <View style={sheet.section}>
          <Text style={[sheet.sectionTitle, { color: colors.textSecondary }]}>
            {t('graph.merge_search_results', '搜索结果')}
          </Text>
          <ScrollView style={sheet.list} keyboardShouldPersistTaps="handled">
            {searching && hits.length === 0 ? (
              <Text style={[sheet.empty, { color: colors.textSecondary }]}>
                {t('graph.merge_searching', '正在搜索…')}
              </Text>
            ) : hits.length === 0 ? (
              <Text style={[sheet.empty, { color: colors.textSecondary }]}>
                {t('graph.merge_search_empty', '没有找到可合并的节点')}
              </Text>
            ) : (
              hits.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => addPick(h)}
                  style={[sheet.row, { borderColor: colors.borderControl }]}
                >
                  <Text style={[sheet.name, { color: colors.textPrimary }]} numberOfLines={1}>
                    {h.name}
                  </Text>
                  <Text style={[sheet.type, { color: colors.textSecondary }]}>
                    {translateGraphNodeType(tr, h.nodeType)}
                  </Text>
                  <Text style={[sheet.add, { color: colors.primary }]}>
                    {t('graph.merge_add', '加入')}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      <View style={sheet.section}>
        <Text style={[sheet.sectionTitle, { color: colors.textSecondary }]}>
          {picks.length === 0
            ? t('graph.merge_picks_empty_title', '已选节点')
            : t('graph.merge_picks_title', '已选 {{count}} 个', { count: picks.length })}
        </Text>
        <ScrollView style={sheet.list} keyboardShouldPersistTaps="handled">
          {picks.length === 0 ? (
            <Text style={[sheet.empty, { color: colors.textSecondary }]}>
              {t('graph.merge_picks_empty', '从上方搜索并加入要合并进来的节点')}
            </Text>
          ) : (
            picks.map((p) => {
              const kept = p.id === survivorId
              return (
                <View
                  key={p.id}
                  style={[
                    sheet.row,
                    {
                      borderColor: colors.borderControl,
                      backgroundColor: kept ? colors.bgSurfaceHigh : colors.bgSurface
                    }
                  ]}
                >
                  <View style={sheet.pickMain}>
                    <Text style={[sheet.name, { color: colors.textPrimary }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[sheet.type, { color: colors.textSecondary }]}>
                      {translateGraphNodeType(tr, p.nodeType)}
                    </Text>
                    {kept ? (
                      <View style={sheet.keepBadge}>
                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>
                          {t('graph.merge_keep_short', '保留')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable onPress={() => removePick(p.id)} hitSlop={8} style={sheet.remove}>
                    <Text style={{ color: colors.textSecondary, fontSize: 18 }}>×</Text>
                  </Pressable>
                </View>
              )
            })
          )}
        </ScrollView>
      </View>

      {error ? <Text style={[sheet.error, { color: colors.error }]}>{error}</Text> : null}

      <View style={[sheet.footer, { borderTopColor: colors.borderMuted }]}>
        <Pressable
          disabled={props.busy}
          onPress={props.onClose}
          style={[sheet.footerBtn, { borderColor: colors.borderControl }]}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>
            {t('common.cancel', '取消')}
          </Text>
        </Pressable>
        <Pressable
          disabled={!canMerge}
          onPress={submit}
          style={[
            sheet.footerBtn,
            {
              borderColor: colors.borderControl,
              backgroundColor: canMerge ? colors.bgSurfaceHigh : 'transparent'
            }
          ]}
        >
          <Text
            style={{
              color: canMerge ? colors.primary : colors.textSecondary,
              fontWeight: '500'
            }}
          >
            {t('graph.merge_selected', '合并所选')}
          </Text>
        </Pressable>
      </View>
    </FloatingModal>
  )
}

const sheet = StyleSheet.create({
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
    gap: 8
  },
  title: {
    fontSize: 17,
    fontWeight: '600'
  },
  lead: {
    fontSize: 13,
    lineHeight: 20
  },
  searchField: {
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden'
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 14
  },
  searchBtn: {
    height: '100%',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderLeftWidth: 1
  },
  meta: {
    marginHorizontal: 20,
    marginTop: 8,
    fontSize: 12
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 20
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  list: {
    maxHeight: 168
  },
  empty: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 10,
    gap: 8
  },
  pickMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  name: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600'
  },
  type: {
    fontSize: 12
  },
  add: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '600'
  },
  keepBadge: {
    marginLeft: 'auto',
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    justifyContent: 'center'
  },
  remove: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  error: {
    marginHorizontal: 20,
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1
  },
  footerBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
