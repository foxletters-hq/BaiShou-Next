import React, { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { translateGraphNodeType, asGraphTranslateFn } from '@baishou/shared'
import { Input, Modal } from '@baishou/ui'
import type { GraphMergeConfirmTarget } from './GraphIrreversibleConfirm'
import styles from './GraphPage.module.css'

export type GraphMergePick = {
  id: string
  name: string
  nodeType: string
}

export const GraphMergeSearchModal: React.FC<{
  isOpen: boolean
  seed: GraphMergePick | null
  busy?: boolean
  onClose: () => void
  onRequestMerge: (target: GraphMergeConfirmTarget) => void
}> = ({ isOpen, seed, busy, onClose, onRequestMerge }) => {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<GraphMergePick[]>([])
  const [picks, setPicks] = useState<GraphMergePick[]>([])
  const [survivorId, setSurvivorId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const start =
      seed && seed.nodeType !== 'entry'
        ? [{ id: seed.id, name: seed.name, nodeType: seed.nodeType }]
        : []
    setQuery('')
    setHits([])
    setPicks(start)
    setSurvivorId(start[0]?.id ?? null)
    setError('')
    setSearched(false)
    setSearching(false)
    // 只在打开时带入当前选中节点，搜索过程中不要被父组件重渲染清空。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const search = async (raw = query) => {
    const q = raw.trim()
    if (!q) {
      setHits([])
      setSearched(false)
      return
    }
    setSearching(true)
    try {
      const nodeType = picks[0]?.nodeType
      const found = (await window.api.graph.search({
        query: q,
        nodeTypes: nodeType ? [nodeType] : undefined,
        limit: 20
      })) as Array<{ id: string; name: string; nodeType: string; reviewStatus?: string }>
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
          .map((n) => ({ id: n.id, name: n.name, nodeType: n.nodeType }))
      )
      setSearched(true)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const q = query.trim()
    if (!q) {
      setHits([])
      setSearched(false)
      return
    }
    const timer = window.setTimeout(() => {
      void search(q)
    }, 280)
    return () => window.clearTimeout(timer)
    // picks 变化时用当前关键词再筛一遍，避免已选项仍留在结果里。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, query, picks])

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
    onRequestMerge({
      survivorId: survivor.id,
      survivorName: survivor.name,
      losers: picks.filter((p) => p.id !== survivor.id).map((p) => ({ id: p.id, name: p.name }))
    })
  }

  const typeLock = picks[0]?.nodeType
  const canMerge = !busy && picks.length >= 2 && Boolean(survivorId)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('graph.merge_nodes', '合并节点')}
      className={styles.mergeDialog}
      zIndex={1850}
    >
      <p className={styles.mergeDialogLead}>
        {t('graph.merge_search_hint', '当前选中的节点会保留。搜索并加入要合并进来的节点，不需要的可以移出。')}
      </p>

      <Input
        fieldSize="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void search()
          }
        }}
        placeholder={t('graph.merge_search_placeholder', '搜索节点名称')}
        autoFocus
        trailing={
          <button
            type="button"
            className={styles.mergeSearchBtn}
            aria-label={t('graph.search', '搜索')}
            title={t('graph.search', '搜索')}
            onClick={() => void search()}
          >
            <Search size={15} strokeWidth={2.25} />
          </button>
        }
      />
      {typeLock ? (
        <div className={styles.mergeDialogMeta}>
          {t('graph.merge_search_type_lock', '仅搜索「{{type}}」', {
            type: translateGraphNodeType(tr, typeLock)
          })}
        </div>
      ) : null}

      {searched || searching ? (
        <section className={styles.mergeDialogSection}>
          <div className={styles.mergeDialogSectionTitle}>
            {t('graph.merge_search_results', '搜索结果')}
          </div>
          <div className={styles.mergeHitList}>
            {searching && hits.length === 0 ? (
              <div className={styles.mergeDialogEmpty}>
                {t('graph.merge_searching', '正在搜索…')}
              </div>
            ) : hits.length === 0 ? (
              <div className={styles.mergeDialogEmpty}>
                {t('graph.merge_search_empty', '没有找到可合并的节点')}
              </div>
            ) : (
              hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className={styles.mergeHitRow}
                  onClick={() => addPick(h)}
                >
                  <span className={styles.mergeHitName}>{h.name}</span>
                  <span className={styles.mergeHitType}>
                    {translateGraphNodeType(tr, h.nodeType)}
                  </span>
                  <span className={styles.mergeHitAdd}>{t('graph.merge_add', '加入')}</span>
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className={styles.mergeDialogSection}>
        <div className={styles.mergeDialogSectionTitle}>
          {picks.length === 0
            ? t('graph.merge_picks_empty_title', '已选节点')
            : t('graph.merge_picks_title', '已选 {{count}} 个', { count: picks.length })}
        </div>
        <div className={styles.mergePickList}>
          {picks.length === 0 ? (
            <div className={styles.mergeDialogEmpty}>
              {t('graph.merge_picks_empty', '从上方搜索并加入要合并进来的节点')}
            </div>
          ) : (
            picks.map((p) => {
              const kept = p.id === survivorId
              return (
                <div
                  key={p.id}
                  className={kept ? styles.mergePickRowActive : styles.mergePickRow}
                >
                  <div className={styles.mergePickMain}>
                    <span className={styles.mergeHitName}>{p.name}</span>
                    <span className={styles.mergeHitType}>
                      {translateGraphNodeType(tr, p.nodeType)}
                    </span>
                    {kept ? (
                      <span className={styles.mergeKeepBadge}>
                        {t('graph.merge_keep_short', '保留')}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.mergePickRemove}
                    aria-label={t('graph.merge_remove_pick', '移出')}
                    onClick={() => removePick(p.id)}
                  >
                    ×
                  </button>
                </div>
              )
            })
          )}
        </div>
      </section>

      {error ? <div className={styles.sameNameBanner}>{error}</div> : null}

      <div className={styles.mergeDialogFooter}>
        <button type="button" className={styles.btn} disabled={busy} onClick={onClose}>
          {t('common.cancel', '取消')}
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!canMerge}
          onClick={submit}
        >
          {t('graph.merge_selected', '合并所选')}
        </button>
      </div>
    </Modal>
  )
}
