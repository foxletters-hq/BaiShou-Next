import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { listNotebookCoverEmojis } from './notebook-cover-emojis'
import styles from './KnowledgePage.module.css'

export const NotebookCoverEmojiPicker: React.FC<{
  open: boolean
  onClose: () => void
  onSelect: (emoji: string) => void
}> = ({ open, onClose, onSelect }) => {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const emojis = useMemo(() => listNotebookCoverEmojis(query), [query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return undefined
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.coverEmojiRoot} role="dialog" aria-modal="true">
      <div
        className={`baishou-app-content-overlay ${styles.coverEmojiOverlay}`}
        onClick={onClose}
      />
      <div className={styles.coverEmojiPanel} onClick={(event) => event.stopPropagation()}>
        <div className={styles.coverEmojiHeader}>
          <label className={styles.coverEmojiSearch}>
            <Search size={14} strokeWidth={2} aria-hidden />
            <input
              className={`baishou-form-field baishou-form-field--small ${styles.coverEmojiSearchInput}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('knowledge.cover_icon_search', '搜索图标')}
              autoFocus
            />
          </label>
          <button
            type="button"
            className={styles.coverEmojiClose}
            onClick={onClose}
            aria-label={t('common.close', '关闭')}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className={styles.coverEmojiGrid}>
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={styles.coverEmojiBtn}
              title={emoji}
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
