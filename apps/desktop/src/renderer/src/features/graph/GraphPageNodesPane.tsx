import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_INVENTORY_PAGE_SIZES,
  asGraphTranslateFn,
  graphInventoryHasItems,
  translateGraphNodeType,
  type GraphInventoryNode,
  type GraphSearchMode
} from '@baishou/shared'
import { Input, PageSizeSelector, Pagination, SegmentedControl } from '@baishou/ui'
import styles from './GraphPage.module.css'

export function GraphPageNodesPane(props: {
  query: string
  onQueryChange: (value: string) => void
  searchMode: GraphSearchMode
  onSearchModeChange: (mode: GraphSearchMode) => void
  listed: {
    items: GraphInventoryNode[]
    total: number
    page: number
    totalPages: number
    showPagination: boolean
  }
  nodeCount: number
  edgeCount: number
  loading: boolean
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onOpenNode: (id: string) => void
}): React.ReactElement {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  return (
    <>
      {graphInventoryHasItems(props.nodeCount) ? (
        <p className={styles.empty}>
          {t('knowledge.graph_inventory', '已有节点 {{nodeCount}} · 关系 {{edgeCount}}', {
            nodeCount: props.nodeCount,
            edgeCount: props.edgeCount
          })}
        </p>
      ) : (
        <p className={styles.empty}>
          {t(
            'graph.inventory_empty_desc',
            '整理日记后，人物、地点和事件会出现在这里。可点开卡片查看节点。'
          )}
        </p>
      )}
      <div className={styles.inventorySearch}>
        <div className={styles.inventorySearchField}>
          <Input
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder={
              props.searchMode === 'semantic'
                ? t('graph.search_placeholder_semantic', '按意思搜索节点…')
                : t('graph.search_placeholder_text', '按名称 / 别名搜索')
            }
            fieldSize="small"
          />
        </div>
        <SegmentedControl
          className={styles.inventorySearchMode}
          stretch={false}
          value={props.searchMode}
          onChange={(value) => props.onSearchModeChange(value as GraphSearchMode)}
          options={[
            { value: 'text', label: t('graph.search_text', '文本搜索') },
            { value: 'semantic', label: t('graph.search_semantic', '语义搜索') }
          ]}
        />
      </div>
      {props.loading ? <p className={styles.empty}>{t('graph.searching', '正在搜索…')}</p> : null}
      {props.listed.items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${styles.item} ${styles.inventoryItem}`}
          onClick={() => props.onOpenNode(item.id)}
        >
          <div className={styles.itemTitle}>{item.name}</div>
          {item.discriminator ? (
            <div className={styles.itemMeta}>
              {t('graph.discriminator_label', '区分')} {item.discriminator}
            </div>
          ) : null}
          {item.nodeType || item.summary ? (
            <div className={styles.itemMeta}>
              {[translateGraphNodeType(tr, item.nodeType ?? ''), item.summary]
                .filter(Boolean)
                .join(' · ')}
            </div>
          ) : null}
          {item.mentionCount != null ? (
            <div className={styles.itemMetaCompact}>
              {t('graph.mention_count', '提及 {{count}} 次', { count: item.mentionCount })}
            </div>
          ) : null}
        </button>
      ))}
      {props.listed.items.length === 0 && !props.loading ? (
        <p className={styles.empty}>
          {props.query.trim()
            ? t('settings.no_search_results', '无匹配的搜索结果')
            : t('knowledge.graph_no_nodes', '暂无节点')}
        </p>
      ) : null}
      {props.listed.showPagination ? (
        <div className={styles.inventoryPagination}>
          <PageSizeSelector
            value={props.pageSize}
            options={[...GRAPH_INVENTORY_PAGE_SIZES]}
            onChange={(size) => {
              props.onPageSizeChange(size)
              props.onPageChange(1)
            }}
            label={t('diary.per_page', '条/页')}
          />
          {props.listed.totalPages > 1 ? (
            <Pagination
              current={props.listed.page}
              total={props.listed.totalPages}
              onChange={props.onPageChange}
              siblingCount={0}
              showJumper
            />
          ) : null}
        </div>
      ) : null}
    </>
  )
}
