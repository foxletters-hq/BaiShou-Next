import React, { useEffect, useMemo, useState } from 'react'
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
import { Button, Input, Modal, Pagination, SegmentedControl } from '@baishou/ui'
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
  canApprove?: boolean
  hasSuspectReason?: boolean
  onClose: () => void
  onSplit: (splitNodeId: string) => void
  onApprove?: () => void
}> = ({
  isOpen,
  nodeId,
  nodeName,
  initialDiscriminator,
  initialLabel,
  busy,
  canApprove,
  hasSuspectReason,
  onClose,
  onSplit,
  onApprove
}) => {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  const [discriminator, setDiscriminator] = useState('')
  const [label, setLabel] = useState('')
  const [labelTouched, setLabelTouched] = useState(false)
  const [summary, setSummary] = useState('')
  const [bareNodeId, setBareNodeId] = useState<string | null>(null)
  const [edges, setEdges] = useState<SplitEdgeRow[]>([])
  const [targets, setTargets] = useState<Record<string, EdgeTarget>>({})
  const [unassignedIds, setUnassignedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!isOpen || !nodeId) return
    setDiscriminator(initialDiscriminator ?? '')
    setLabel(initialLabel ?? '')
    setLabelTouched(Boolean(initialLabel?.trim()))
    setSummary('')
    setError('')
    setUnassignedIds([])
    setSaving(false)
    setPage(1)
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
          ({
            nodeId,
            name: nodeName ?? '',
            discriminator: '',
            label: nodeName ?? ''
          } satisfies NameCandidate)
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

  const originalName = (nodeName ?? '').trim()
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

  const setTarget = (edgeId: string, target: EdgeTarget) => {
    setTargets((prev) => ({ ...prev, [edgeId]: target }))
  }

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
    if (!bareNodeId) {
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
      const result = await window.api.graph.splitNode({
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
      onSplit(result.splitNodeId)
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
      title={t('graph.split_node_title', '把同名的拆成两个')}
      className={`${styles.graphFormModal} ${styles.splitFormModal}`}
      zIndex={1850}
    >
      <p className={styles.mergeDialogLead}>
        {t(
          'graph.split_node_hint',
          '先写清新的这个和原来的怎么区分。下面每条关系可以留给原来的、给新的，或先不管。先不管的下次还能继续分。'
        )}
      </p>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>
          {t('graph.split_discriminator', '怎么区分这两个人')}
        </div>
        <Input
          value={discriminator}
          onChange={(e) => changeDiscriminator(e.target.value)}
          placeholder={t('graph.discriminator_placeholder', '例如：同事、大学同学')}
          autoFocus
        />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.split_label', '图谱上怎么称呼新的这个')}</div>
        <Input
          value={label}
          onChange={(e) => {
            setLabelTouched(true)
            setLabel(e.target.value)
          }}
          placeholder={t('graph.split_label_placeholder', '例如：{{name}}（同事）', {
            name: originalName || '张三'
          })}
        />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.split_summary', '一句话介绍新的这个')}</div>
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>
          {t('graph.split_edges_heading', '这些关系分别是谁的')}
        </div>
        <div className={styles.detailValue}>
          {loading
            ? t('graph.source_loading', '加载中…')
            : t('graph.split_unassigned_count', '还有 {{count}} 条关系还没决定给谁', {
                count: unassignedIds.length > 0 ? unassignedIds.length : unassignedCount
              })}
        </div>
      </div>
      {edges.length === 0 && !loading ? (
        <div className={styles.empty}>
          {t('graph.split_edges_empty', '这个节点目前没有可分配的关系')}
        </div>
      ) : (
        <>
          <div className={styles.splitEdgeList}>
            {visibleEdges.map((edge) => {
              const leftover = unassignedIds.includes(edge.edgeId)
              return (
                <div
                  key={edge.edgeId}
                  className={leftover ? styles.splitEdgeRowUnassigned : styles.splitEdgeRow}
                >
                  <div className={styles.splitEdgeMain}>
                    <div className={styles.relationPartner}>
                      {formatGraphSplitPartnerName(edge.partnerName)}
                    </div>
                    <div className={styles.splitEdgeMeta}>
                      {translateGraphEdgeType(tr, edge.edgeType)}
                      {edge.sourceExcerpt ? ` · ${edge.sourceExcerpt}` : ''}
                      {leftover ? ` · ${t('graph.split_unassigned', '先不管')}` : ''}
                    </div>
                  </div>
                  <SegmentedControl
                    stretch
                    aria-label={t('graph.split_edge_assign', '分配这条关系')}
                    value={targets[edge.edgeId] ?? 'unassigned'}
                    onChange={(value) => setTarget(edge.edgeId, value)}
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
                </div>
              )
            })}
          </div>
          {pageCount > 1 ? (
            <div className={styles.splitPager}>
              <Pagination
                current={page}
                total={pageCount}
                onChange={setPage}
                showJumper={pageCount > 8}
                showFirstLast={false}
              />
            </div>
          ) : null}
        </>
      )}
      {error ? <div className={styles.sameNameBanner}>{error}</div> : null}
      <div className={styles.mergeDialogFooter}>
        {canApprove ? (
          <Button type="button" disabled={saving || busy} onClick={() => void onApprove?.()}>
            {hasSuspectReason ? t('graph.clear_suspect', '解除怀疑') : t('graph.approve', '通过')}
          </Button>
        ) : null}
        <Button type="button" disabled={saving || busy} onClick={onClose}>
          {t('common.cancel', '取消')}
        </Button>
        <Button
          type="button"
          disabled={saving || busy || loading || !discriminator.trim()}
          onClick={() => void submit()}
        >
          {saving ? t('graph.split_saving', '拆分中…') : t('graph.split_confirm', '确认拆分')}
        </Button>
      </div>
    </Modal>
  )
}
