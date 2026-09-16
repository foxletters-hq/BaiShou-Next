import i18n from 'i18next'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RAG_VECTOR_KIND_FILTERS,
  ragVectorKindLabelKey,
  type RagVectorKindFilter
} from '@baishou/shared'
import { Eraser, EllipsisVertical, Search, X } from 'lucide-react'
import { Input } from '../Input/Input'
import { Button } from '../Button/Button'
import { SegmentedControl } from '../shared/SegmentedControl'
import { AnchoredContextMenu } from '../ContextMenu/AnchoredContextMenu'
import { RagMemoryParamsModal } from './RagMemoryParamsModal'
import type { RagConfig } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryToolbarProps {
  config: RagConfig
  isBusy: boolean
  searchQuery: string
  searchMode: 'semantic' | 'text'
  sourceKind: RagVectorKindFilter
  onChange: (config: RagConfig) => void
  onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearSearch: () => void
  onToggleSearchMode: () => void
  onSourceKindChange: (kind: RagVectorKindFilter) => void
  onAddManualMemory?: () => Promise<void>
  onOpenClear?: () => void
}

const KIND_FALLBACK: Record<RagVectorKindFilter, string> = {
  all: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagMemoryToolbar.L39', '全部'),
  diary: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagMemoryToolbar.L40', '日记'),
  partner: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagMemoryToolbar.L41', '伙伴'),
  manual: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagMemoryToolbar.L42', '手动'),
  graph_node: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagMemoryToolbar.L43', '节点')
}

export const RagMemoryToolbar: React.FC<RagMemoryToolbarProps> = ({
  config,
  isBusy,
  searchQuery,
  searchMode,
  sourceKind,
  onChange,
  onSearch,
  onClearSearch,
  onToggleSearchMode,
  onSourceKindChange,
  onAddManualMemory,
  onOpenClear
}) => {
  const { t } = useTranslation()
  const [paramsOpen, setParamsOpen] = useState(false)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuAt({ x: rect.left, y: rect.bottom + 6 })
  }

  return (
    <div className={styles.toolbarStack}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <Input
            type="text"
            fieldSize="small"
            className={styles.searchInput}
            inputClassName="baishou-form-field--embed"
            placeholder={
              searchMode === 'semantic'
                ? t('settings.rag_search_semantic_hint', '语义搜索记忆内容...')
                : t('settings.rag_search_text_hint', '文本搜索记忆内容...')
            }
            value={searchQuery}
            onChange={onSearch}
          />
          {searchQuery ? (
            <button
              type="button"
              className={styles.searchClear}
              aria-label={t('common.clear_search', '清除搜索')}
              onClick={onClearSearch}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <SegmentedControl
          inline
          value={searchMode}
          aria-label={t('settings.rag_search_mode', '搜索模式')}
          onChange={(mode) => {
            if (mode !== searchMode) onToggleSearchMode()
          }}
          options={[
            { value: 'semantic', label: t('settings.rag_search_semantic', '语义搜索') },
            { value: 'text', label: t('settings.rag_search_text', '文本搜索') }
          ]}
        />

        <span className={styles.toolbarSpacer} />

        <Button
          type="button"
          variant="outlined"
          size="small"
          disabled={isBusy}
          onClick={() => void onAddManualMemory?.()}
        >
          {t('settings.rag_add_manual', '手动添加记忆')}
        </Button>

        <Button type="button" variant="outlined" size="small" onClick={() => setParamsOpen(true)}>
          {t('settings.rag_change_retrieval', '更改检索设置')}
        </Button>

        <button
          type="button"
          className={`${styles.toolBtn} ${styles.toolBtnIcon}`}
          title={t('common.more', '更多')}
          aria-label={t('common.more', '更多')}
          onClick={openMenu}
        >
          <EllipsisVertical size={15} />
        </button>
      </div>

      <div
        className={styles.kindFilterRow}
        role="tablist"
        aria-label={t('settings.rag_filter_kind', '向量类型')}
      >
        {RAG_VECTOR_KIND_FILTERS.map((kind) => {
          const active = sourceKind === kind
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.kindChip}${active ? ` ${styles.kindChipActive}` : ''}`}
              onClick={() => onSourceKindChange(kind)}
            >
              {t(ragVectorKindLabelKey(kind), KIND_FALLBACK[kind])}
            </button>
          )
        })}
      </div>

      <RagMemoryParamsModal
        open={paramsOpen}
        config={config}
        onChange={onChange}
        onClose={() => setParamsOpen(false)}
      />

      {menuAt ? (
        <AnchoredContextMenu
          x={menuAt.x}
          y={menuAt.y}
          menuClassName={`context-menu ${styles.moreMenu}`}
          onClose={() => setMenuAt(null)}
          items={[
            {
              label: t('settings.rag_clear_all', '清除记忆'),
              icon: <Eraser size={15} />,
              onClick: () => onOpenClear?.()
            }
          ]}
        />
      ) : null}
    </div>
  )
}
