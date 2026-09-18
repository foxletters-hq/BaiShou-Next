import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { asGraphTranslateFn, translateGraphEdgeType } from '@baishou/shared'
import { Button, FloatingModal, Input, SegmentedControl, useNativeTheme } from '@baishou/ui/native'
import type { AppDatabase } from '@baishou/database'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import {
  mobileListNameCandidates,
  mobileListSplitEdges,
  mobileSplitErrorMessage,
  mobileSplitGraphNode,
  type MobileSplitEdgeRow
} from '@/src/services/mobile-graph-split'

type EdgeTarget = 'unassigned' | 'bare' | 'split'

export function GraphSplitNodeSheet(props: {
  visible: boolean
  nodeId: string | null
  nodeName?: string
  initialDiscriminator?: string
  initialLabel?: string
  drizzleDb: AppDatabase | null
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultName: string
  busy?: boolean
  onClose: () => void
  onSplit: (splitNodeId: string) => void
}): React.ReactElement {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  const { colors } = useNativeTheme()
  const [discriminator, setDiscriminator] = useState('')
  const [label, setLabel] = useState('')
  const [summary, setSummary] = useState('')
  const [bareNodeId, setBareNodeId] = useState<string | null>(null)
  const [edges, setEdges] = useState<MobileSplitEdgeRow[]>([])
  const [targets, setTargets] = useState<Record<string, EdgeTarget>>({})
  const [unassignedIds, setUnassignedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!props.visible || !props.nodeId || !props.drizzleDb) return
    setDiscriminator(props.initialDiscriminator ?? '')
    setLabel(props.initialLabel ?? '')
    setSummary('')
    setError('')
    setUnassignedIds([])
    setSaving(false)
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const candidates = await mobileListNameCandidates(props.drizzleDb!, props.nodeId!)
        if (cancelled) return
        const bare = candidates.find((item) => !item.discriminator) ??
          candidates[0] ?? {
            nodeId: props.nodeId!,
            name: props.nodeName ?? '',
            discriminator: '',
            label: props.nodeName ?? ''
          }
        setBareNodeId(bare.nodeId)
        const rows = await mobileListSplitEdges(props.drizzleDb!, bare.nodeId)
        if (cancelled) return
        setEdges(rows)
        setTargets(Object.fromEntries(rows.map((row) => [row.edgeId, 'unassigned' as EdgeTarget])))
      } catch (e) {
        if (!cancelled) setError(mobileSplitErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    props.visible,
    props.nodeId,
    props.nodeName,
    props.initialDiscriminator,
    props.initialLabel,
    props.drizzleDb
  ])

  const unassignedCount = useMemo(
    () => edges.filter((edge) => (targets[edge.edgeId] ?? 'unassigned') === 'unassigned').length,
    [edges, targets]
  )

  const submit = async () => {
    if (!bareNodeId || !props.drizzleDb) return
    const trimmedDisc = discriminator.trim()
    const trimmedLabel = label.trim()
    if (!trimmedDisc) {
      setError(t('graph.split_discriminator_required', '请填写区分信息'))
      return
    }
    if (!trimmedLabel) {
      setError(t('graph.split_label_required', '请填写展示标签'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const edgeAssignments = edges
        .map((edge) => {
          const target = targets[edge.edgeId] ?? 'unassigned'
          if (target === 'unassigned') return null
          return { edgeId: edge.edgeId, target }
        })
        .filter((item): item is { edgeId: string; target: 'bare' | 'split' } => item != null)
      const result = await mobileSplitGraphNode({
        drizzleDb: props.drizzleDb,
        pathService: props.pathService,
        fileSystem: props.fileSystem,
        vaultId: props.vaultId,
        vaultName: props.vaultName,
        bareNodeId,
        discriminator: trimmedDisc,
        label: trimmedLabel,
        summary,
        edgeAssignments
      })
      setUnassignedIds(result.unassignedEdgeIds)
      if (result.unassignedEdgeIds.length === 0) {
        props.onSplit(result.splitNodeId)
        return
      }
      setTargets((prev) => {
        const next = { ...prev }
        for (const edgeId of result.unassignedEdgeIds) next[edgeId] = 'unassigned'
        return next
      })
    } catch (e) {
      setError(mobileSplitErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FloatingModal visible={props.visible} onClose={props.onClose} closeOnBackdropPress={!saving}>
      <View style={{ padding: 20, gap: 10, maxHeight: 560 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>
          {t('graph.split_node_title', '拆分同名实体')}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          {t(
            'graph.split_node_hint',
            '填写区分信息和展示标签，再把关系留给原实体或归给新实体。还没分配的关系下次还能继续。'
          )}
        </Text>
        <Input
          label={t('graph.discriminator_label', '区分信息')}
          value={discriminator}
          onChangeText={setDiscriminator}
        />
        <Input label={t('graph.split_label', '展示标签')} value={label} onChangeText={setLabel} />
        <Input label={t('graph.label_summary', '摘要')} value={summary} onChangeText={setSummary} />
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {loading
            ? t('graph.source_loading', '加载中…')
            : t('graph.split_unassigned_count', '还有 {{count}} 条关系尚未分配', {
                count: unassignedIds.length > 0 ? unassignedIds.length : unassignedCount
              })}
        </Text>
        <ScrollView style={{ maxHeight: 220 }}>
          {edges.length === 0 && !loading ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t('graph.split_edges_empty', '这个节点目前没有可分配的关系')}
            </Text>
          ) : (
            edges.map((edge) => {
              const leftover = unassignedIds.includes(edge.edgeId)
              return (
                <View key={edge.edgeId} style={{ gap: 6, marginBottom: 12 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                    {edge.partnerName}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {translateGraphEdgeType(tr, edge.edgeType)}
                    {edge.sourceExcerpt ? ` · ${edge.sourceExcerpt}` : ''}
                    {leftover ? ` · ${t('graph.split_unassigned', '尚未分配')}` : ''}
                  </Text>
                  <SegmentedControl
                    accessibilityLabel={t('graph.split_edge_assign', '分配这条关系')}
                    value={targets[edge.edgeId] ?? 'unassigned'}
                    onChange={(value) => setTargets((prev) => ({ ...prev, [edge.edgeId]: value }))}
                    options={[
                      { value: 'unassigned', label: t('graph.split_unassigned', '尚未分配') },
                      { value: 'bare', label: t('graph.split_keep_bare', '留在原实体') },
                      { value: 'split', label: t('graph.split_move_to_new', '归给新实体') }
                    ]}
                  />
                </View>
              )
            })
          )}
        </ScrollView>
        {error ? <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outlined" disabled={saving || props.busy} onPress={props.onClose}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            disabled={saving || props.busy || loading || !discriminator.trim() || !label.trim()}
            onPress={() => void submit()}
          >
            {t('graph.split_confirm', '确认拆分')}
          </Button>
        </View>
      </View>
    </FloatingModal>
  )
}
