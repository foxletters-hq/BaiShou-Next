import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, Library, Search, X } from 'lucide-react'
import {
  Pagination,
  PageSizeSelector,
  SegmentedControl
} from '@baishou/ui'
import { formatRecallTimestamp } from '@baishou/shared'
import { useSettingsStore } from '@baishou/store'
import { callKnowledgeApi } from './call-knowledge-api'
import styles from './KnowledgePage.module.css'

type SearchMode = 'semantic' | 'text'

type ChunkCard = {
  chunkId: string
  sourceId: string
  sourceTitle: string
  chunkIndex: number
  chunkText: string
  modelId: string
  createdAt?: number
  score?: number
}

interface KnowledgeVectorPaneProps {
  notebookId: string
  sourceCount: number
  chunkCount: number
  storageLine: string
  busy: boolean
  onPreviewSource?: (sourceId: string) => void
}

export const KnowledgeVectorPane: React.FC<KnowledgeVectorPaneProps> = ({
  notebookId,
  sourceCount,
  chunkCount,
  storageLine,
  busy,
  onPreviewSource
}) => {
  const { t } = useTranslation()
  const embeddingModelId = useSettingsStore((s) => s.globalModels?.globalEmbeddingModelId || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('semantic')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [items, setItems] = useState<ChunkCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<number | null>(null)
  const loadGen = useRef(0)

  const load = useCallback(async () => {
    if (!notebookId) return
    const gen = ++loadGen.current
    setLoading(true)
    setError('')
    try {
      const q = committedQuery.trim()
      if (q && searchMode === 'semantic') {
        const hits = (await callKnowledgeApi<
          Array<{
            chunkId: string
            sourceId: string
            chunkIndex: number
            chunkText: string
            score: number
            title?: string
          }>
        >('search', 'knowledge:search', {
          notebookId,
          query: q,
          topK: pageSize
        })) as Array<{
          chunkId: string
          sourceId: string
          chunkIndex: number
          chunkText: string
          score: number
          title?: string
        }>
        if (gen !== loadGen.current) return
        setItems(
          (hits || []).map((hit) => ({
            chunkId: hit.chunkId,
            sourceId: hit.sourceId,
            sourceTitle: hit.title || hit.sourceId,
            chunkIndex: hit.chunkIndex,
            chunkText: hit.chunkText,
            modelId: embeddingModelId,
            score: hit.score
          }))
        )
        setTotal((hits || []).length)
        return
      }

      const result = await callKnowledgeApi<{
        items: Array<{
          chunkId: string
          sourceId: string
          chunkIndex: number
          chunkText: string
          modelId: string
          createdAt: number
          sourceTitle: string | null
        }>
        total: number
      }>('listChunks', 'knowledge:list-chunks', {
        notebookId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        query: q || undefined
      })
      if (gen !== loadGen.current) return
      setItems(
        (result.items || []).map((row) => ({
          chunkId: row.chunkId,
          sourceId: row.sourceId,
          sourceTitle: row.sourceTitle || row.sourceId,
          chunkIndex: row.chunkIndex,
          chunkText: row.chunkText,
          modelId: row.modelId,
          createdAt: row.createdAt
        }))
      )
      setTotal(Number(result.total ?? 0))
    } catch (e) {
      if (gen !== loadGen.current) return
      setError(String((e as Error)?.message || e))
      setItems([])
      setTotal(0)
    } finally {
      if (gen === loadGen.current) setLoading(false)
    }
  }, [committedQuery, embeddingModelId, notebookId, page, pageSize, searchMode])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const showPagination = searchMode === 'text' || !committedQuery.trim() ? total > 10 : false

  const stats = useMemo(
    () => [
      {
        key: 'chunks',
        label: t('knowledge.vector_stat_chunks', '片段'),
        value: String(chunkCount)
      },
      {
        key: 'sources',
        label: t('knowledge.vector_stat_sources', '来源'),
        value: String(sourceCount)
      },
      {
        key: 'model',
        label: t('knowledge.vector_stat_model', '嵌入模型'),
        value: embeddingModelId || t('knowledge.vector_model_unset', '未配置')
      }
    ],
    [chunkCount, embeddingModelId, sourceCount, t]
  )

  return (
    <section className={styles.vectorPane} aria-label={t('knowledge.tab_vectors', '向量知识库')}>
      <div className={styles.vectorScroll}>
        <div className={styles.vectorStatsRow}>
          {stats.map((item) => (
            <div key={item.key} className={styles.vectorStatChip}>
              <span className={styles.vectorStatIcon}>
                <Database size={14} />
              </span>
              <span className={styles.vectorStatLabel}>{item.label}</span>
              <span className={styles.vectorStatValue}>{item.value}</span>
            </div>
          ))}
        </div>
        {storageLine ? <p className={styles.vectorStorageLine}>{storageLine}</p> : null}

        <div className={styles.vectorSearchBox}>
          <span className={styles.vectorSearchIcon}>
            <Search size={18} />
          </span>
          <input
            type="text"
            className={`baishou-form-field baishou-form-field--small ${styles.vectorSearchInput}`}
            value={searchQuery}
            placeholder={
              searchMode === 'semantic'
                ? t('knowledge.vector_search_semantic_hint', '语义搜索片段内容…')
                : t('knowledge.vector_search_text_hint', '文本搜索片段内容…')
            }
            onChange={(e) => {
              const next = e.target.value
              setSearchQuery(next)
              if (debounceRef.current) window.clearTimeout(debounceRef.current)
              debounceRef.current = window.setTimeout(() => {
                setPage(1)
                setCommittedQuery(next)
              }, 280)
            }}
          />
          <SegmentedControl
            inline
            value={searchMode}
            aria-label={t('knowledge.vector_search_mode', '搜索模式')}
            options={[
              { value: 'semantic', label: t('knowledge.vector_search_semantic', '语义搜索') },
              { value: 'text', label: t('knowledge.vector_search_text', '文本搜索') }
            ]}
            onChange={(mode) => {
              setSearchMode(mode)
              setPage(1)
            }}
          />
          {searchQuery ? (
            <button
              type="button"
              className={styles.vectorSearchClear}
              onClick={() => {
                if (debounceRef.current) window.clearTimeout(debounceRef.current)
                setSearchQuery('')
                setCommittedQuery('')
                setPage(1)
              }}
              aria-label={t('common.clear', '清除')}
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        {error ? <p className={styles.bannerError}>{error}</p> : null}

        {items.length === 0 && !loading ? (
          <div className={styles.vectorEmpty}>
            <Library size={48} />
            <p className={styles.vectorEmptyTitle}>
              {committedQuery
                ? t('common.no_search_result', '没有找到相关结果')
                : t('knowledge.vector_empty_title', '还没有向量片段')}
            </p>
            <p className={styles.vectorEmptyHint}>
              {t(
                'knowledge.vector_empty_hint',
                '导入资料并完成索引后，这里会列出本笔记本的向量片段，可按语义或文本检索。'
              )}
            </p>
          </div>
        ) : (
          <div className={styles.vectorList}>
            {items.map((item) => (
              <article key={item.chunkId} className={styles.vectorCard}>
                <div className={styles.vectorCardMark} aria-hidden>
                  {'{}'}
                </div>
                <div className={styles.vectorCardBody}>
                  <p className={styles.vectorCardText}>{item.chunkText}</p>
                  <div className={styles.vectorCardMeta}>
                    {onPreviewSource ? (
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => onPreviewSource(item.sourceId)}
                      >
                        {item.sourceTitle}
                      </button>
                    ) : (
                      <span>{item.sourceTitle}</span>
                    )}
                    <span>·</span>
                    <span>
                      {t('knowledge.citation_chunk', '片段 #{{index}}', {
                        index: item.chunkIndex
                      })}
                    </span>
                    {item.modelId ? (
                      <>
                        <span>·</span>
                        <span>{item.modelId}</span>
                      </>
                    ) : null}
                    {item.createdAt ? (
                      <>
                        <span>·</span>
                        <span>{formatRecallTimestamp(item.createdAt)}</span>
                      </>
                    ) : null}
                    {item.score != null ? (
                      <>
                        <span>·</span>
                        <span>
                          {t('recall.similarity', '相似度')}: {Math.round(item.score * 100)}%
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {showPagination ? (
          <div className={styles.vectorPagination}>
            <span className={styles.vectorPaginationInfo}>
              {t('settings.rag_pagination_info', '共 $total 条').replace('$total', String(total))}
            </span>
            <div className={styles.vectorPaginationControls}>
              <PageSizeSelector
                value={pageSize}
                options={[10, 20, 30, 50, 100]}
                onChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                label={t('settings.rag_per_page', '条/页')}
              />
              <Pagination
                current={page}
                total={totalPages}
                onChange={setPage}
                siblingCount={1}
                showJumper
                jumperPlaceholder={t('settings.rag_jump_to_page', '跳转')}
                disabled={busy || loading}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
