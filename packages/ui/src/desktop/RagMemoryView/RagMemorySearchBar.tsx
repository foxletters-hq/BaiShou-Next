import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './RagMemoryView.module.css'
import seg from '../shared/SegmentedControl.module.css'
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
      <input
        type="text"
        placeholder={
          searchMode === 'semantic'
            ? t('settings.rag_search_semantic_hint', '语义搜索记忆内容...')
            : t('settings.rag_search_text_hint', '文本搜索记忆内容...')
        }
        className={styles.searchOuterInput}
        value={searchQuery}
        onChange={onSearch}
      />
      <div className={`${seg.group} ${seg.groupInline}`}>
        <button
          type="button"
          className={`${seg.btn} ${searchMode === 'semantic' ? seg.btnActive : ''}`}
          onClick={() => searchMode !== 'semantic' && onToggleSearchMode()}
        >
          {t('settings.rag_search_semantic', '语义搜索')}
        </button>
        <button
          type="button"
          className={`${seg.btn} ${searchMode === 'text' ? seg.btnActive : ''}`}
          onClick={() => searchMode !== 'text' && onToggleSearchMode()}
        >
          {t('settings.rag_search_text', '文本搜索')}
        </button>
      </div>
      {searchQuery && (
        <div className={styles.clearSearchOuter} onClick={onClearSearch}>
          <X size={18} />
        </div>
      )}
    </div>
  )
}
