import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Eraser,
  EllipsisVertical,
  Library,
  MessageSquarePlus,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react'
import { Input } from '../Input/Input'
import { SegmentedControl } from '../shared/SegmentedControl'
import { AnchoredContextMenu } from '../ContextMenu/AnchoredContextMenu'
import { RagMemoryParamsModal } from './RagMemoryParamsModal'
import type { RagConfig, RagState, RagStats } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryToolbarProps {
  config: RagConfig
  stats: RagStats
  ragState: RagState
  isBusy: boolean
  isBatchEmbedding: boolean
  searchQuery: string
  searchMode: 'semantic' | 'text'
  onChange: (config: RagConfig) => void
  onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearSearch: () => void
  onToggleSearchMode: () => void
  onBatchEmbed?: () => Promise<void>
  onAddManualMemory?: () => Promise<void>
  onClearAll?: () => Promise<void>
}

export const RagMemoryToolbar: React.FC<RagMemoryToolbarProps> = ({
  config,
  stats,
  ragState,
  isBusy,
  isBatchEmbedding,
  searchQuery,
  searchMode,
  onChange,
  onSearch,
  onClearSearch,
  onToggleSearchMode,
  onBatchEmbed,
  onAddManualMemory,
  onClearAll
}) => {
  const { t } = useTranslation()
  const [paramsOpen, setParamsOpen] = useState(false)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuAt({ x: rect.right - 160, y: rect.bottom + 6 })
  }

  return (
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

      <button
        type="button"
        className={styles.toolBtn}
        data-rag-action="batch-embed"
        disabled={isBusy}
        onClick={() => void onBatchEmbed?.()}
      >
        <Library size={15} />
        <span>
          {isBatchEmbedding
            ? `${t('common.processing', '处理中')} ${ragState.progress}/${ragState.total}`
            : t('settings.rag_batch_embed', '全量嵌入日记')}
        </span>
      </button>

      <button
        type="button"
        className={styles.toolBtn}
        disabled={isBusy}
        onClick={() => void onAddManualMemory?.()}
      >
        <MessageSquarePlus size={15} />
        <span>{t('settings.rag_add_manual', '手动添加记忆')}</span>
      </button>

      <button
        type="button"
        className={`${styles.toolBtn} ${styles.toolBtnIcon}`}
        title={t('settings.rag_config_params', '检索参数调节')}
        aria-label={t('settings.rag_config_params', '检索参数调节')}
        onClick={() => setParamsOpen(true)}
      >
        <SlidersHorizontal size={15} />
      </button>

      <button
        type="button"
        className={`${styles.toolBtn} ${styles.toolBtnIcon}`}
        title={t('common.more', '更多')}
        aria-label={t('common.more', '更多')}
        onClick={openMenu}
      >
        <EllipsisVertical size={15} />
      </button>

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
          onClose={() => setMenuAt(null)}
          items={[
            {
              label: t('settings.rag_clear_all', '清空现有记忆'),
              icon: <Eraser size={15} />,
              disabled: stats.totalCount === 0,
              onClick: () => void onClearAll?.()
            }
          ]}
        />
      ) : null}
    </div>
  )
}
