import React, { useEffect, useRef } from 'react'
import { FileText, History } from 'lucide-react'
import styles from './InputBar.module.css'

export type FileMentionPickerItem = {
  id: string
  path: string
  group: 'recent' | 'search'
  onSelect: () => void
}

type Props = {
  items: FileMentionPickerItem[]
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onClose: () => void
  emptyHint?: string
}

export function FileMentionPicker({
  items,
  selectedIndex,
  onSelectIndex,
  onClose,
  emptyHint
}: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const selected = listRef.current?.querySelector(`[data-file-mention-index="${selectedIndex}"]`)
    if (selected instanceof HTMLElement) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  useEffect(() => {
    const handlePointer = (e: MouseEvent) => {
      if (listRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const timer = window.setTimeout(() => {
      window.addEventListener('mousedown', handlePointer)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('mousedown', handlePointer)
    }
  }, [onClose])

  if (items.length === 0) {
    return (
      <div className={styles.skillSlashPicker} ref={listRef}>
        <p className={styles.skillSlashEmpty}>
          {emptyHint || '输入文件名以搜索工作区'}
        </p>
      </div>
    )
  }

  return (
    <div className={styles.skillSlashPicker} role="listbox" ref={listRef}>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          data-file-mention-index={index}
          className={`${styles.skillSlashItem}${index === selectedIndex ? ` ${styles.skillSlashItemSelected}` : ''}`}
          onMouseEnter={() => onSelectIndex(index)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => item.onSelect()}
        >
          <span className={styles.skillSlashIcon} aria-hidden>
            {item.group === 'recent' ? <History size={14} strokeWidth={2} /> : <FileText size={14} strokeWidth={2} />}
          </span>
          <span className={styles.skillSlashName}>{item.path}</span>
          <span className={styles.skillSlashDesc}>
            {item.group === 'recent' ? '最近打开' : '工作区文件'}
          </span>
        </button>
      ))}
    </div>
  )
}
