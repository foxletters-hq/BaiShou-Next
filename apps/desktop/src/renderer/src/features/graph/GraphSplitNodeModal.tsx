import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { asGraphTranslateFn, translateGraphEdgeType } from '@baishou/shared'
import { Button, Input, Modal, SegmentedControl } from '@baishou/ui'
import styles from './GraphPage.module.css'

type EdgeTarget = 'unassigned' | 'bare' | 'split'

type SplitEdgeRow = {
  edgeId: string
  edgeType: string
  partnerName: string
  sourceRef: string | null
  sourceExcerpt: string
}

type NameCandidate = {
  nodeId: string
  name: string
  discriminator: string
  label: string
}

export const GraphSplitNodeModal: React.FC<{
  isOpen: boolean
  nodeId: string | null
  nodeName?: string
  initialDiscriminator?: string
  initialLabel?: string
  busy?: boolean
  onClose: () => void
  onSplit: (splitNodeId: string) => void
}> = ({
  isOpen,
  nodeId,
  nodeName,
  initialDiscriminator,
  initialLabel,
  busy,
  onClose,
  onSplit
}) => {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  const [discriminator, setDiscriminator] = useState('')
  const [label, setLabel] = useState('')
  const [summary, setSummary] = useState('')
  const [bareNodeId, setBareNodeId] = useState<string | null>(null)
  const [edges, setEdges] = useState<SplitEdgeRow[]>([])
  const [targets, setTargets] = useState<Record<string, EdgeTarget>>({})
  const [unassignedIds, setUnassignedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !nodeId) return
    setDiscriminator(initialDiscriminator ?? '')
    setLabel(initialLabel ?? '')
    setSummary('')
    setError('')
    setUnassignedIds([])
    setSaving(false)
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const candidates = (await window.api.graph.listNameCandidates({
          nodeId
        })) as NameCandidate[]
        if (cancelled) return
        const bare =
          candidates.find((item) => !item.discriminator) ??
          candidates[0] ??
          ({ nodeId, name: nodeName ?? '', discriminator: '', label: nodeName ?? '' } satisfies NameCandidate)
        setBareNodeId(bare.nodeId)
        const rows = (await window.api.graph.listSplitEdges({
          nodeId: bare.nodeId
        })) as SplitEdgeRow[]
        if (cancelled) return
        setEdges(rows)
        setTargets(Object.fromEntries(rows.map((row) => [row.edgeId, 'unassigned' as EdgeTarget])))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, nodeId, nodeName, initialDiscriminator, initialLabel])

  const unassignedCount = useMemo(
    () => edges.filter((edge) => (targets[edge.edgeId] ?? 'unassigned') === 'unassigned').length,
    [edges, targets]
  )

  const setTarget = (edgeId: string, target: EdgeTarget) => {
    setTargets((prev) => ({ ...prev, [edgeId]: target }))
  }

  const submit = async () => {
    if (!bareNodeId) return
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
      const result = await window.api.graph.splitNode({
        bareNodeId,
        discriminator: trimmedDisc,
        label: trimmedLabel,
        summary,
        edgeAssignments
      })
      setUnassignedIds(result.unassignedEdgeIds)
      if (result.unassignedEdgeIds.length === 0) {
        onSplit(result.splitNodeId)
        return
      }
      setTargets((prev) => {
        const next = { ...prev }
        for (const edgeId of result.unassignedEdgeIds) next[edgeId] = 'unassigned'
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('graph.split_node_title', '拆分同名实体')}
      className={`${styles.graphFormModal} ${styles.splitFormModal}`}
      zIndex={1850}
    >
      <p className={styles.mergeDialogLead}>
        {t(
          'graph.split_node_hint',
          '填写区分信息和展示标签，再把关系留给原实体或归给新实体。还没分配的关系下次还能继续。'
        )}
      </p>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.discriminator_label', '区分信息')}</div>
        <Input
          fieldSize="small"
          value={discriminator}
          onChange={(e) => setDiscriminator(e.target.value)}
          autoFocus
        />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.split_label', '展示标签')}</div>
        <Input fieldSize="small" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.label_summary', '摘要')}</div>
        <Input fieldSize="small" value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.split_unassigned', '尚未分配')}</div>
        <div className={styles.detailValue}>
          {loading
            ? t('graph.source_loading', '加载中…')
            : t('graph.split_unassigned_count', '还有 {{count}} 条关系尚未分配', {
                count: unassignedIds.length > 0 ? unassignedIds.length : unassignedCount
              })}
        </div>
      </div>
      {edges.length === 0 && !loading ? (
        <div className={styles.empty}>{t('graph.split_edges_empty', '这个节点目前没有可分配的关系')}</div>
      ) : (
        <div className={styles.splitEdgeList}>
          {edges.map((edge) => {
            const leftover = unassignedIds.includes(edge.edgeId)
            return (
              <div
                key={edge.edgeId}
                className={leftover ? styles.splitEdgeRowUnassigned : styles.splitEdgeRow}
              >
                <div className={styles.splitEdgeMain}>
                  <div className={styles.relationPartner}>{edge.partnerName}</div>
                  <div className={styles.splitEdgeMeta}>
                    {translateGraphEdgeType(tr, edge.edgeType)}
                    {edge.sourceExcerpt ? ` · ${edge.sourceExcerpt}` : ''}
                    {leftover ? ` · ${t('graph.split_unassigned', '尚未分配')}` : ''}
                  </div>
                </div>
                <SegmentedControl
                  inline
                  aria-label={t('graph.split_edge_assign', '分配这条关系')}
                  value={targets[edge.edgeId] ?? 'unassigned'}
                  onChange={(value) => setTarget(edge.edgeId, value)}
                  options={[
                    { value: 'unassigned', label: t('graph.split_unassigned', '尚未分配') },
                    { value: 'bare', label: t('graph.split_keep_bare', '留在原实体') },
                    { value: 'split', label: t('graph.split_move_to_new', '归给新实体') }
                  ]}
                />
              </div>
            )
          })}
        </div>
      )}
      {error ? <div className={styles.sameNameBanner}>{error}</div> : null}
      <div className={styles.mergeDialogFooter}>
        <Button type="button" disabled={saving || busy} onClick={onClose}>
          {t('common.cancel', '取消')}
        </Button>
        <Button
          type="button"
          disabled={saving || busy || loading || !discriminator.trim() || !label.trim()}
          onClick={() => void submit()}
        >
          {t('graph.split_confirm', '确认拆分')}
        </Button>
      </div>
    </Modal>
  )
}
