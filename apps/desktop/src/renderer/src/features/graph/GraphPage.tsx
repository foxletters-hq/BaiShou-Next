import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraphForceCanvas } from './GraphForceCanvas'
import styles from './GraphPage.module.css'

type SideTab = 'reextract' | 'pending' | 'detail'

export const GraphPage: React.FC = () => {
  const navigate = useNavigate()
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [localView, setLocalView] = useState<{ nodes: any[]; edges: any[] } | null>(null)
  const [pendingReextract, setPendingReextract] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [tab, setTab] = useState<SideTab>('reextract')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [hideEntry, setHideEntry] = useState(true)

  const refresh = useCallback(async () => {
    const graph = await window.api.graph.getGlobalGraph({ maxNodes: 250 })
    setNodes(graph.nodes || [])
    setEdges(graph.edges || [])
    setPendingReextract(await window.api.graph.listPendingReextract())
    setPendingEdges(await window.api.graph.listPendingEdges())
  }, [])

  useEffect(() => {
    void refresh().catch((e) => setStatus(String(e?.message || e)))
  }, [refresh])

  const displayNodes = useMemo(() => {
    const base = localView?.nodes ?? nodes
    return hideEntry ? base.filter((n) => n.nodeType !== 'entry') : base
  }, [nodes, localView, hideEntry])

  const displayEdges = useMemo(() => {
    const idSet = new Set(displayNodes.map((n) => n.id))
    const base = localView?.edges ?? edges
    return base.filter((e) => idSet.has(e.fromId) && idSet.has(e.toId))
  }, [displayNodes, edges, localView])

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
    setStatus('正在抽取…')
    try {
      const result = await window.api.graph.extract({ filePaths })
      setStatus(`完成 ${result.done}，失败 ${result.failed}`)
      await refresh()
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const reviewEdge = async (edgeId: string, reviewStatus: 'approved' | 'rejected') => {
    await window.api.graph.setEdgeReview({ edgeId, reviewStatus })
    await refresh()
  }

  const openSource = (sourceRef: string | null | undefined) => {
    if (!sourceRef) return
    const m = String(sourceRef).match(/(\d{4}-\d{2}-\d{2})/)
    if (m) navigate(`/diary/${m[1]}`)
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.title}>关系图谱</div>
        <input
          className={styles.search}
          placeholder="搜索实体 / 别名"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onSearch()
          }}
        />
        <button type="button" className={styles.btn} onClick={() => void onSearch()}>
          搜索
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
          全局
        </button>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={hideEntry}
            onChange={(e) => setHideEntry(e.target.checked)}
          />
          隐藏日记锚点
        </label>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={busy || pendingReextract.length === 0}
          onClick={() => void runExtract()}
        >
          梳理待重抽 ({pendingReextract.length})
        </button>
        <button type="button" className={styles.btn} disabled={busy} onClick={() => void refresh()}>
          刷新
        </button>
        {status ? <span className={styles.itemMeta}>{status}</span> : null}
      </div>

      <div className={styles.canvasWrap}>
        <GraphForceCanvas
          nodes={displayNodes}
          edges={displayEdges}
          highlightIds={highlightIds}
          selectedId={selectedId}
          onSelectNode={(id) => void onSelectNode(id)}
        />
      </div>

      <aside className={styles.side}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'reextract' ? styles.tabActive : ''}`}
            onClick={() => setTab('reextract')}
          >
            待重抽
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`}
            onClick={() => setTab('pending')}
          >
            待确认
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'detail' ? styles.tabActive : ''}`}
            onClick={() => setTab('detail')}
          >
            详情
          </button>
        </div>
        <div className={styles.panel}>
          {tab === 'reextract' && (
            <>
              {pendingReextract.length === 0 ? (
                <div className={styles.empty}>暂无待重抽日记</div>
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
                        抽取这篇
                      </button>
                      {item.date ? (
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => navigate(`/diary/${item.date}`)}
                        >
                          打开原文
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
              {pendingEdges.length === 0 ? (
                <div className={styles.empty}>没有待确认的边</div>
              ) : (
                pendingEdges.map((edge) => (
                  <div key={edge.id} className={styles.item}>
                    <div className={styles.itemTitle}>
                      {edge.edgeType} · confidence {edge.confidence}
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
                        通过
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => void reviewEdge(edge.id, 'rejected')}
                      >
                        拒绝
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => openSource(edge.sourceRef)}
                      >
                        原文
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'detail' && (
            <>
              {!selectedNode ? (
                <div className={styles.empty}>点击画布节点查看详情</div>
              ) : (
                <>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>名称</div>
                    <div className={styles.detailValue}>{selectedNode.name}</div>
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>类型</div>
                    <div className={styles.detailValue}>{selectedNode.nodeType}</div>
                  </div>
                  {selectedNode.summary ? (
                    <div className={styles.detailBlock}>
                      <div className={styles.detailLabel}>摘要</div>
                      <div className={styles.detailValue}>{selectedNode.summary}</div>
                    </div>
                  ) : null}
                  {Array.isArray(selectedNode.aliases) && selectedNode.aliases.length > 0 ? (
                    <div className={styles.detailBlock}>
                      <div className={styles.detailLabel}>别名</div>
                      <div className={styles.detailValue}>{selectedNode.aliases.join('、')}</div>
                    </div>
                  ) : null}
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>局部关系</div>
                    <div className={styles.detailValue}>
                      {(localView?.edges || []).length} 条边 · {(localView?.nodes || []).length}{' '}
                      个节点
                    </div>
                  </div>
                  {(localView?.edges || [])
                    .filter((e) => e.sourceRef)
                    .slice(0, 8)
                    .map((e) => (
                      <div key={e.id} className={styles.item}>
                        <div className={styles.itemMeta}>
                          {e.edgeType}
                          {e.sourceExcerpt ? ` · ${e.sourceExcerpt}` : ''}
                        </div>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.btn}
                            onClick={() => openSource(e.sourceRef)}
                          >
                            打开原文 {e.sourceRef}
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
