import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Terminal } from 'lucide-react'
import { PageSizeSelector } from '../PageSizeSelector'
import styles from './PromptShortcutSheet.module.css'
import { useTranslation } from 'react-i18next'
import {
  getShortcutCommand,
  getDefaultShortcutLabelsFromT,
  localizePromptShortcut,
  type PromptShortcut
} from '@baishou/shared'

export type { PromptShortcut }

export interface PromptShortcutSheetProps {
  isOpen: boolean
  shortcuts: PromptShortcut[]
  selectedIndex: number
  onSelect: (shortcut: PromptShortcut) => void
  /** 内联模式：不分页，展示全部匹配项 */
  compact?: boolean
}

export const PromptShortcutSheet: React.FC<PromptShortcutSheetProps> = ({
  isOpen,
  shortcuts,
  selectedIndex,
  onSelect,
  compact = false
}) => {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(shortcuts.length / pageSize))
  const paginatedShortcuts = useMemo(() => {
    if (compact) return shortcuts
    const start = (currentPage - 1) * pageSize
    return shortcuts.slice(start, start + pageSize)
  }, [shortcuts, currentPage, pageSize, compact])

  // 切换页码时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [shortcuts.length])

  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector(`.${styles.itemSelected}`) as HTMLElement
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex, isOpen, currentPage])

  if (!isOpen) return null

  const labels = getDefaultShortcutLabelsFromT(t)

  const getLocalizedShortcut = (shortcut: PromptShortcut) => {
    const localized = localizePromptShortcut(shortcut, labels)
    const cmd = getShortcutCommand(localized)
    return {
      ...localized,
      command: cmd,
      name: localized.name || localized.tag || 'Prompt',
      icon: localized.icon,
      description: localized.description || localized.content
    }
  }

  const showPagination = !compact && shortcuts.length > 5
  const startIdx = compact ? 0 : (currentPage - 1) * pageSize

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>{t('shortcut.title', '快捷指令')}</div>
      <div className={styles.listArea} ref={listRef}>
        {paginatedShortcuts.map((rawShortcut, i) => {
          const globalIndex = startIdx + i
          const shortcut = getLocalizedShortcut(rawShortcut)
          return (
            <div
              key={shortcut.id}
              className={`${styles.item} ${globalIndex === selectedIndex ? styles.itemSelected : ''}`}
              onClick={() => onSelect(shortcut)}
            >
              <div className={styles.itemIcon}>
                {shortcut.icon ? (
                  <span style={{ fontSize: 14 }}>{shortcut.icon}</span>
                ) : (
                  <Terminal size={14} />
                )}
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.titleRow}>
                  <span className={styles.command}>/{shortcut.command}</span>
                  {shortcut.name && <span className={styles.tag}>{shortcut.name}</span>}
                </div>
                <div className={styles.desc}>{shortcut.description}</div>
              </div>
            </div>
          )
        })}
        {shortcuts.length === 0 && (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text-secondary)'
            }}
          >
            {t('shortcut.no_match', '找不到任何匹配的快捷指令...')}
          </div>
        )}
      </div>
      {showPagination && (
        <div className={styles.paginationBar}>
          <PageSizeSelector
            value={pageSize}
            options={[5, 10, 15, 20, 25, 30]}
            onChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            label={t('diary.per_page', '条/页')}
          />
          <button
            className={styles.pageBtn}
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            &lsaquo;
          </button>
          <span className={styles.pageCurrent}>
            {currentPage}/{totalPages}
          </span>
          <button
            className={styles.pageBtn}
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            &rsaquo;
          </button>
        </div>
      )}
    </div>
  )
}

export * from './ShortcutManagerDialog'
