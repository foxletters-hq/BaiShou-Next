import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { GraphForceCanvas } from './GraphForceCanvas'
import styles from './GraphPage.module.css'

type SideTab = 'reextract' | 'pending' | 'detail'

type CostEstimate = {
  entryCount: number
  estimatedTokens: number
  estimatedYuanLow: number
  estimatedYuanHigh: number
  estimatedMinutesLow: number
  estimatedMinutesHigh: number
}

export const GraphPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [localView, setLocalView] = useState<{ nodes: any[]; edges: any[] } | null>(null)
  const [pendingReextract, setPendingReextract] = useState<any[]>([])
  const [pendingNodes, setPendingNodes] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [tab, setTab] = useState<SideTab>('reextract')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [hideEntry, setHideEntry] = useState(true)
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [dismissGuide, setDismissGuide] = useState(false)
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [edgeTypes, setEdgeTypes] = useState<string[]>([])
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editAliases, setEditAliases] = useState('')
  const [addEdgeToId, setAddEdgeToId] = useState('')
  const [addEdgeType, setAddEdgeType] = useState('relates_to')
  const [addEdgeQuery, setAddEdgeQuery] = useState('')
  const [addEdgeHits, setAddEdgeHits] = useState<any[]>([])

  const refresh = useCallback(async () => {
    const graph = await window.api.graph.getGlobalGraph({ maxNodes: 250 })
    setNodes(graph.nodes || [])
    setEdges(graph.edges || [])
    setPendingReextract(await window.api.graph.listPendingReextract())
    const pending = await window.api.graph.listPending()
    setPendingNodes(pending.nodes || [])
    setPendingEdges(pending.edges || [])
    try {
      setEstimate(await window.api.graph.estimateExtraction())
    } catch {
      setEstimate(null)
    }
  }, [])

  useEffect(() => {
    void refresh().catch((e) => setStatus(String(e?.message || e)))
    void window.api.graph.meta().then((m) => {
      setEdgeTypes(m.edgeTypes || [])
      if (m.edgeTypes?.[0]) setAddEdgeType(m.edgeTypes[0])
    })
  }, [refresh])

  useEffect(() => {
    if (!selectedNode) return
    setEditName(selectedNode.name || '')
    setEditSummary(selectedNode.summary || '')
    setEditAliases(Array.isArray(selectedNode.aliases) ? selectedNode.aliases.join(', ') : '')
  }, [selectedNode])

  const showEmptyGuide =
    !dismissGuide &&
    nodes.filter((n) => n.reviewStatus !== 'rejected').length === 0 &&
    (estimate?.entryCount ?? pendingReextract.length) > 0

  const displayNodes = useMemo(() => {
    const base = localView?.nodes ?? nodes
    return base.filter((n) => {
      if (n.reviewStatus === 'rejected') return false
      if (hideEntry && n.nodeType === 'entry') return false
      if (approvedOnly && n.reviewStatus === 'pending') return false
      return true
    })
  }, [nodes, localView, hideEntry, approvedOnly])

  const displayEdges = useMemo(() => {
    const idSet = new Set(displayNodes.map((n) => n.id))
    const base = localView?.edges ?? edges
    return base.filter((e) => {
      if (e.reviewStatus === 'rejected') return false
      if (approvedOnly && e.reviewStatus === 'pending') return false
      return idSet.has(e.fromId) && idSet.has(e.toId)
    })
  }, [displayNodes, edges, localView, approvedOnly])

  const pendingCount = pendingNodes.length + pendingEdges.length

  const onSearch = async () => {
    const q = query.trim()
    if (!q) {
      setHighlightIds(new Set())
      setLocalView(null)
      return
    }
    const hits = await window.api.graph.search({ query: q, limit: 20 })
    const ids = new Set((hits || []).map((h: any) => h.id as string))
    setHighlightIds(ids)
    if (hits?.[0]) {
      setSelectedId(hits[0].id)
      const view = await window.api.graph.getView({ centerNodeId: hits[0].id, depth: 2 })
      setLocalView(view)
      setSelectedNode(hits[0])
      setTab('detail')
    }
  }

  const onSelectNode = async (id: string) => {
    setSelectedId(id)
    setTab('detail')
    const node = await window.api.graph.getNode(id)
    setSelectedNode(node)
    const view = await window.api.graph.getView({ centerNodeId: id, depth: 2 })
    setLocalView(view)
  }

  const runExtract = async (filePaths?: string[]) => {
    setBusy(true)
    setStatus(t('graph.extracting', '正在抽取…'))
    setDismissGuide(true)
    try {
      const unsub = window.api.graph.onExtractProgress((p) => {
        setStatus(
          t('graph.extract_progress', '正在整理 {{current}}/{{total}}', {
            current: p.current,
            total: p.total
          })
        )
      })
      const result = await window.api.graph.extract({ filePaths })
      unsub()
      if (result.cancelled) {
        setStatus(
          t('graph.extract_cancelled', '已停止：完成 {{done}}，剩余仍待重抽', {
            done: result.done
          })
        )
      } else if (result.done === 0 && result.failed === 0) {
        setStatus(t('graph.extract_nothing', '没有可抽取的日记'))
      } else if (result.done === 0) {
        setStatus(
          t('graph.extract_all_failed', '抽取未成功（失败 {{failed}}）', {
            failed: result.failed
          })
        )
      } else {
        setStatus(
          t('graph.extract_batch_result', '完成 {{done}}，失败 {{failed}}', {
            done: result.done,
            failed: result.failed
          })
        )
      }
      await refresh()
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const cancelExtract = async () => {
    await window.api.graph.cancelExtract()
  }

  const reviewEdge = async (edgeId: string, reviewStatus: 'approved' | 'rejected') => {
    await window.api.graph.setEdgeReview({ edgeId, reviewStatus })
    await refresh()
  }

  const reviewNode = async (nodeId: string, reviewStatus: 'approved' | 'rejected') => {
    await window.api.graph.setNodeReview({ nodeId, reviewStatus })
    await refresh()
  }

  const saveNodeEdit = async () => {
    if (!selectedNode) return
    setBusy(true)
    try {
      const aliases = editAliases
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean)
      await window.api.graph.upsertNode({
        id: selectedNode.id,
        name: editName.trim() || selectedNode.name,
        nodeType: selectedNode.nodeType,
        aliases,
        summary: editSummary
      })
      setStatus(t('graph.edit_saved', '已保存（手工修正，重抽不会覆盖）'))
      await refresh()
      const node = await window.api.graph.getNode(selectedNode.id)
      setSelectedNode(node)
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const deleteSelectedNode = async () => {
    if (!selectedNode) return
    if (!window.confirm(t('graph.confirm_delete_node', '确定删除该节点？相关边也会一并软删。'))) {
      return
    }
    setBusy(true)
    try {
      await window.api.graph.softDelete({ kind: 'node', id: selectedNode.id })
      setSelectedNode(null)
      setSelectedId(null)
      setLocalView(null)
      await refresh()
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const deleteEdge = async (edgeId: string) => {
    if (!window.confirm(t('graph.confirm_delete_edge', '确定删除这条关系？'))) return
    setBusy(true)
    try {
      await window.api.graph.softDelete({ kind: 'edge', id: edgeId })
      await refresh()
      if (selectedId) {
        const view = await window.api.graph.getView({ centerNodeId: selectedId, depth: 2 })
        setLocalView(view)
      }
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const searchAddEdgeTarget = async () => {
    const q = addEdgeQuery.trim()
    if (!q) {
      setAddEdgeHits([])
      return
    }
    const hits = await window.api.graph.search({ query: q, limit: 12 })
    setAddEdgeHits((hits || []).filter((h: any) => h.id !== selectedId))
  }

  const addEdge = async () => {
    if (!selectedId || !addEdgeToId) return
    setBusy(true)
    try {
      await window.api.graph.upsertEdge({
        fromId: selectedId,
        toId: addEdgeToId,
        edgeType: addEdgeType
      })
      setAddEdgeToId('')
      setAddEdgeQuery('')
      setAddEdgeHits([])
      setStatus(t('graph.edge_added', '已添加关系'))
      await refresh()
      const view = await window.api.graph.getView({ centerNodeId: selectedId, depth: 2 })
      setLocalView(view)
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const openSource = (sourceRef: string | null | undefined) => {
    if (!sourceRef) return
    const m = String(sourceRef).match(/(\d{4}-\d{2}-\d{2})/)
    if (m) navigate(`/diary/${m[1]}`)
  }

  const formatTokens = (n: number) => {
    if (n >= 10000) return t('graph.tokens_wan', '约 {{n}} 万', { n: (n / 10000).toFixed(1) })
    return t('graph.tokens_count', '约 {{n}}', { n })
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.title}>{t('graph.title', '关系图谱')}</div>
        <input
          className={styles.search}
          placeholder={t('graph.search_placeholder', '搜索实体 / 别名')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onSearch()
          }}
        />
        <button type="button" className={styles.btn} onClick={() => void onSearch()}>
          {t('graph.search', '搜索')}
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            setLocalView(null)
            setHighlightIds(new Set())
            setSelectedId(null)
          }}
        >
          {t('graph.global_view', '全局')}
        </button>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={hideEntry}
            onChange={(e) => setHideEntry(e.target.checked)}
          />
          {t('graph.hide_entry_anchors', '隐藏日记锚点')}
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={approvedOnly}
            onChange={(e) => setApprovedOnly(e.target.checked)}
          />
          {t('graph.approved_only', '只看已确认')}
        </label>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={busy || pendingReextract.length === 0}
          onClick={() => void runExtract()}
        >
          {t('graph.process_pending_reextract', '梳理待重抽 ({{count}})', {
            count: pendingReextract.length
          })}
        </button>
        {busy ? (
          <button type="button" className={styles.btn} onClick={() => void cancelExtract()}>
            {t('graph.stop_extract', '停止')}
          </button>
        ) : null}
        <button type="button" className={styles.btn} disabled={busy} onClick={() => void refresh()}>
          {t('graph.refresh', '刷新')}
        </button>
        {status ? <span className={styles.itemMeta}>{status}</span> : null}
      </div>

      <div className={styles.canvasWrap}>
        {showEmptyGuide ? (
          <div className={styles.emptyGuide}>
            <div className={styles.emptyGuideTitle}>
              {t('graph.empty_guide_title', '还没有开始整理你的关系图谱')}
            </div>
            <div className={styles.emptyGuideBody}>
              {t(
                'graph.empty_guide_body',
                '发现 {{count}} 篇日记可以分析，预计消耗 {{tokens}} tokens（约 ¥{{yuanLow}}–{{yuanHigh}}），用时约 {{minLow}}–{{minHigh}} 分钟。',
                {
                  count: estimate?.entryCount ?? pendingReextract.length,
                  tokens: formatTokens(estimate?.estimatedTokens ?? 0),
                  yuanLow: estimate?.estimatedYuanLow ?? 0,
                  yuanHigh: estimate?.estimatedYuanHigh ?? 0,
                  minLow: estimate?.estimatedMinutesLow ?? 1,
                  minHigh: estimate?.estimatedMinutesHigh ?? 1
                }
              )}
            </div>
            <div className={styles.emptyGuideHint}>
              {t('graph.legend_pending', '虚线的关系伙伴还看不到，需要你确认。')}
            </div>
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={busy}
                onClick={() => void runExtract()}
              >
                {t('graph.start_organize', '开始整理')}
              </button>
              <button type="button" className={styles.btn} onClick={() => setDismissGuide(true)}>
                {t('graph.later', '以后再说')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <GraphForceCanvas
              nodes={displayNodes}
              edges={displayEdges}
              highlightIds={highlightIds}
              selectedId={selectedId}
              onSelectNode={(id) => void onSelectNode(id)}
            />
            <div className={styles.legend}>
              {t('graph.legend_pending', '虚线的关系伙伴还看不到，需要你确认。')}
            </div>
          </>
        )}
      </div>

      <aside className={styles.side}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'reextract' ? styles.tabActive : ''}`}
            onClick={() => setTab('reextract')}
          >
            {t('graph.tab_reextract', '待重抽')}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`}
            onClick={() => setTab('pending')}
          >
            {t('graph.tab_pending_count', '待确认 ({{count}})', { count: pendingCount })}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'detail' ? styles.tabActive : ''}`}
            onClick={() => setTab('detail')}
          >
            {t('graph.tab_detail', '详情')}
          </button>
        </div>
        <div className={styles.panel}>
          {tab === 'reextract' && (
            <>
              {pendingReextract.length === 0 ? (
                <div className={styles.empty}>
                  {t('graph.no_pending_reextract', '暂无待重抽日记')}
                </div>
              ) : (
                pendingReextract.map((item) => (
                  <div key={item.filePath} className={styles.item}>
                    <div className={styles.itemTitle}>{item.date || item.filePath}</div>
                    <div className={styles.itemMeta}>{item.filePath}</div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={busy}
                        onClick={() => void runExtract([item.filePath])}
                      >
                        {t('graph.extract_this', '抽取这篇')}
                      </button>
                      {item.date ? (
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => navigate(`/diary/${item.date}`)}
                        >
                          {t('graph.open_source', '打开原文')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'pending' && (
            <>
              {pendingCount === 0 ? (
                <div className={styles.empty}>{t('graph.no_pending', '没有待确认的节点或边')}</div>
              ) : (
                <>
                  {pendingNodes.map((node) => (
                    <div key={`n-${node.id}`} className={styles.item}>
                      <div className={styles.itemTitle}>
                        {t('graph.pending_node', '节点')} · {node.name}
                      </div>
                      <div className={styles.itemMeta}>
                        {node.nodeType}
                        {node.summary ? ` · ${node.summary}` : ''}
                      </div>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={() => void reviewNode(node.id, 'approved')}
                        >
                          {t('graph.approve', '通过')}
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => void reviewNode(node.id, 'rejected')}
                        >
                          {t('graph.reject', '拒绝')}
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => void onSelectNode(node.id)}
                        >
                          {t('graph.view', '查看')}
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingEdges.map((edge) => (
                    <div key={`e-${edge.id}`} className={styles.item}>
                      <div className={styles.itemTitle}>
                        {t('graph.pending_edge', '关系')} · {edge.edgeType} · {edge.confidence}
                      </div>
                      <div className={styles.itemMeta}>
                        {edge.fromId.slice(0, 8)} → {edge.toId.slice(0, 8)}
                        {edge.sourceExcerpt ? ` · ${edge.sourceExcerpt}` : ''}
                      </div>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={() => void reviewEdge(edge.id, 'approved')}
                        >
                          {t('graph.approve', '通过')}
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => void reviewEdge(edge.id, 'rejected')}
                        >
                          {t('graph.reject', '拒绝')}
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => openSource(edge.sourceRef)}
                        >
                          {t('graph.source', '原文')}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {tab === 'detail' && (
            <>
              {!selectedNode ? (
                <div className={styles.empty}>
                  {t('graph.click_node_for_detail', '点击画布节点查看详情')}
                </div>
              ) : (
                <>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_name', '名称')}</div>
                    <input
                      className={styles.editInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_type', '类型')}</div>
                    <div className={styles.detailValue}>{selectedNode.nodeType}</div>
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_summary', '摘要')}</div>
                    <textarea
                      className={styles.editArea}
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_aliases', '别名')}</div>
                    <input
                      className={styles.editInput}
                      value={editAliases}
                      onChange={(e) => setEditAliases(e.target.value)}
                      placeholder={t('graph.aliases_placeholder', '逗号分隔')}
                    />
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_review', '审核')}</div>
                    <div className={styles.detailValue}>
                      {selectedNode.reviewStatus || 'approved'}
                      {selectedNode.origin === 'user'
                        ? ` · ${t('graph.origin_user', '手工修正')}`
                        : ''}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={busy}
                      onClick={() => void saveNodeEdit()}
                    >
                      {t('graph.save_edit', '保存修改')}
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => void deleteSelectedNode()}
                    >
                      {t('graph.delete_node', '删除节点')}
                    </button>
                  </div>
                  {selectedNode.reviewStatus === 'pending' ? (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => void reviewNode(selectedNode.id, 'approved')}
                      >
                        {t('graph.approve', '通过')}
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => void reviewNode(selectedNode.id, 'rejected')}
                      >
                        {t('graph.reject', '拒绝')}
                      </button>
                    </div>
                  ) : null}

                  <div className={styles.detailBlock} style={{ marginTop: 16 }}>
                    <div className={styles.detailLabel}>{t('graph.add_edge', '添加关系')}</div>
                    <input
                      className={styles.editInput}
                      value={addEdgeQuery}
                      onChange={(e) => setAddEdgeQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void searchAddEdgeTarget()
                      }}
                      placeholder={t('graph.add_edge_search', '搜索目标节点')}
                    />
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => void searchAddEdgeTarget()}
                      >
                        {t('graph.search', '搜索')}
                      </button>
                      <select
                        className={styles.editSelect}
                        value={addEdgeType}
                        onChange={(e) => setAddEdgeType(e.target.value)}
                      >
                        {(edgeTypes.length ? edgeTypes : ['relates_to']).map((et) => (
                          <option key={et} value={et}>
                            {et}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        disabled={busy || !addEdgeToId}
                        onClick={() => void addEdge()}
                      >
                        {t('graph.add_edge_submit', '添加')}
                      </button>
                    </div>
                    {addEdgeHits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        className={`${styles.hitBtn} ${addEdgeToId === h.id ? styles.hitBtnActive : ''}`}
                        onClick={() => setAddEdgeToId(h.id)}
                      >
                        {h.name} · {h.nodeType}
                      </button>
                    ))}
                  </div>

                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>
                      {t('graph.local_relations', '局部关系')}
                    </div>
                    <div className={styles.detailValue}>
                      {t('graph.local_view_stats', '{{edgeCount}} 条边 · {{nodeCount}} 个节点', {
                        edgeCount: (localView?.edges || []).length,
                        nodeCount: (localView?.nodes || []).length
                      })}
                    </div>
                  </div>
                  {(localView?.edges || []).slice(0, 12).map((e) => (
                    <div key={e.id} className={styles.item}>
                      <div className={styles.itemMeta}>
                        {e.edgeType}
                        {e.reviewStatus === 'pending'
                          ? ` · ${t('graph.pending_badge', '待确认')}`
                          : ''}
                        {e.sourceExcerpt ? ` · ${e.sourceExcerpt}` : ''}
                      </div>
                      <div className={styles.rowActions}>
                        {e.sourceRef ? (
                          <button
                            type="button"
                            className={styles.btn}
                            onClick={() => openSource(e.sourceRef)}
                          >
                            {t('graph.open_source', '打开原文')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => void deleteEdge(e.id)}
                        >
                          {t('graph.delete_edge', '删除')}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
