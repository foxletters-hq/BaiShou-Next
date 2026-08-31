import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './RagMemoryView.module.css'
import { Input } from '../Input/Input'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Search, X } from 'lucide-react'

interface RagMemorySearchBarProps {
  searchQuery: string
  searchMode: 'semantic' | 'text'
  onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearSearch: () => void
  onToggleSearchMode: () => void
}

export const RagMemorySearchBar: React.FC<RagMemorySearchBarProps> = ({
  searchQuery,
  searchMode,
  onSearch,
  onClearSearch,
  onToggleSearchMode
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.searchBoxOuter}>
      <div className={styles.searchIconOuter}>
        <Search size={20} />
      </div>
      <Input
        type="text"
        fieldSize="small"
        className={styles.searchOuterInput}
        inputClassName="baishou-form-field--embed"
        placeholder={
          searchMode === 'semantic'
            ? t('settings.rag_search_semantic_hint', '语义搜索记忆内容...')
            : t('settings.rag_search_text_hint', '文本搜索记忆内容...')
        }
        value={searchQuery}
        onChange={onSearch}
      />
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
      {searchQuery && (
        <div className={styles.clearSearchOuter} onClick={onClearSearch}>
          <X size={18} />
        </div>
      )}
    </div>
  )
}
