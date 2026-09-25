import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  asGraphTranslateFn,
  formatGraphSplitPartnerName,
  graphSplitEdgePageCount,
  graphSplitNewDisplayName,
  shouldCloseGraphSplitAfterSave,
  sliceGraphSplitEdges,
  translateGraphEdgeType
} from '@baishou/shared'
import {
  Button,
  FloatingModal,
  Input,
  Pagination,
  SegmentedControl,
  useNativeTheme
} from '@baishou/ui/native'
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
  canApprove?: boolean
  hasSuspectReason?: boolean
  onClose: () => void
  onSplit: (splitNodeId: string) => void
  onApprove?: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  const { colors } = useNativeTheme()
  const [discriminator, setDiscriminator] = useState('')
  const [label, setLabel] = useState('')
  const [labelTouched, setLabelTouched] = useState(false)
  const [summary, setSummary] = useState('')
  const [bareNodeId, setBareNodeId] = useState<string | null>(null)
  const [edges, setEdges] = useState<MobileSplitEdgeRow[]>([])
  const [targets, setTargets] = useState<Record<string, EdgeTarget>>({})
  const [unassignedIds, setUnassignedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!props.visible || !props.nodeId || !props.drizzleDb) return
    setDiscriminator(props.initialDiscriminator ?? '')
    setLabel(props.initialLabel ?? '')
    setLabelTouched(Boolean(props.initialLabel?.trim()))
    setSummary('')
    setError('')
    setUnassignedIds([])
    setSaving(false)
    setPage(1)
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

  const originalName = (props.nodeName ?? '').trim()
  const newDisplayName = graphSplitNewDisplayName({
    nodeName: originalName,
    discriminator,
    label
  })
  const pageCount = graphSplitEdgePageCount(edges.length)
  const visibleEdges = useMemo(() => sliceGraphSplitEdges(edges, page), [edges, page])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const unassignedCount = useMemo(
    () => edges.filter((edge) => (targets[edge.edgeId] ?? 'unassigned') === 'unassigned').length,
    [edges, targets]
  )

  const changeDiscriminator = (value: string) => {
    setDiscriminator(value)
    if (labelTouched) return
    setLabel(
      graphSplitNewDisplayName({
        nodeName: originalName,
        discriminator: value,
        label: ''
      })
    )
  }

  const submit = async () => {
    if (!bareNodeId || !props.drizzleDb) {
      setError(t('graph.split_not_ready', '节点还没准备好，请关了再打开一次'))
      return
    }
    const trimmedDisc = discriminator.trim()
    const trimmedLabel =
      label.trim() ||
      graphSplitNewDisplayName({
        nodeName: originalName,
        discriminator: trimmedDisc,
        label: ''
      })
    if (!trimmedDisc) {
      setError(t('graph.split_discriminator_required', '请填写怎么区分这两个人'))
      return
    }
    if (!trimmedLabel) {
      setError(t('graph.split_label_required', '请填写图谱上怎么称呼新的这个'))
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
      if (!shouldCloseGraphSplitAfterSave(result)) {
        setError(t('graph.split_failed', '拆分失败'))
        return
      }
      props.onSplit(result.splitNodeId)
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
          {t('graph.split_node_title', '把同名的拆成两个')}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          {t(
            'graph.split_node_hint',
            '先写清新的这个和原来的怎么区分。下面每条关系可以留给原来的、给新的，或先不管。先不管的下次还能继续分。'
          )}
        </Text>
        <Input
          label={t('graph.split_discriminator', '怎么区分这两个人')}
          value={discriminator}
          onChangeText={changeDiscriminator}
          placeholder={t('graph.discriminator_placeholder', '例如：同事、大学同学')}
        />
        <Input
          label={t('graph.split_label', '图谱上怎么称呼新的这个')}
          value={label}
          onChangeText={(value) => {
            setLabelTouched(true)
            setLabel(value)
          }}
          placeholder={t('graph.split_label_placeholder', '例如：{{name}}（同事）', {
            name: originalName || '张三'
          })}
        />
        <Input
          label={t('graph.split_summary', '一句话介绍新的这个')}
          value={summary}
          onChangeText={setSummary}
        />
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
          {t('graph.split_edges_heading', '这些关系分别是谁的')}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {loading
            ? t('graph.source_loading', '加载中…')
            : t('graph.split_unassigned_count', '还有 {{count}} 条关系还没决定给谁', {
                count: unassignedIds.length > 0 ? unassignedIds.length : unassignedCount
              })}
        </Text>
        <ScrollView style={{ maxHeight: 220 }}>
          {edges.length === 0 && !loading ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t('graph.split_edges_empty', '这个节点目前没有可分配的关系')}
            </Text>
          ) : (
            visibleEdges.map((edge) => {
              const leftover = unassignedIds.includes(edge.edgeId)
              return (
                <View key={edge.edgeId} style={{ gap: 6, marginBottom: 12 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                    {formatGraphSplitPartnerName(edge.partnerName)}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {translateGraphEdgeType(tr, edge.edgeType)}
                    {edge.sourceExcerpt ? ` · ${edge.sourceExcerpt}` : ''}
                    {leftover ? ` · ${t('graph.split_unassigned', '先不管')}` : ''}
                  </Text>
                  <SegmentedControl
                    accessibilityLabel={t('graph.split_edge_assign', '分配这条关系')}
                    value={targets[edge.edgeId] ?? 'unassigned'}
                    onChange={(value) => setTargets((prev) => ({ ...prev, [edge.edgeId]: value }))}
                    options={[
                      { value: 'unassigned', label: t('graph.split_unassigned', '先不管') },
                      {
                        value: 'bare',
                        label: t('graph.split_keep_bare', '原来的 · {{name}}', {
                          name: originalName || '—'
                        })
                      },
                      {
                        value: 'split',
                        label: t('graph.split_move_to_new', '新的 · {{name}}', {
                          name: newDisplayName || originalName || '—'
                        })
                      }
                    ]}
                  />
                </View>
              )
            })
          )}
        </ScrollView>
        {pageCount > 1 ? (
          <Pagination
            current={page}
            total={pageCount}
            onChange={setPage}
            showJumper={pageCount > 8}
          />
        ) : null}
        {error ? <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          {props.canApprove ? (
            <Button
              variant="outlined"
              disabled={saving || props.busy}
              onPress={() => void props.onApprove?.()}
            >
              {props.hasSuspectReason
                ? t('graph.clear_suspect', '解除怀疑')
                : t('graph.approve', '通过')}
            </Button>
          ) : null}
          <Button variant="outlined" disabled={saving || props.busy} onPress={props.onClose}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            disabled={saving || props.busy || loading || !discriminator.trim()}
            onPress={() => void submit()}
          >
            {saving
              ? t('graph.split_saving', '拆分中…')
              : t('graph.split_confirm', '确认拆分')}
          </Button>
        </View>
      </View>
    </FloatingModal>
  )
}
