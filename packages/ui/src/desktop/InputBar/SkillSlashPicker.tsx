import React, { useEffect, useRef } from 'react'
import { FolderOpen, Plus, Sparkles } from 'lucide-react'
import styles from './InputBar.module.css'

export type SkillSlashPickerItem = {
  id: string
  name: string
  description: string
  iconKind?: 'software' | 'workspace' | 'create'
  onSelect: () => void
}

type Props = {
  items: SkillSlashPickerItem[]
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onClose: () => void
}

function SlashItemIcon({ kind }: { kind?: SkillSlashPickerItem['iconKind'] }) {
  if (kind === 'create') return <Plus size={14} strokeWidth={2} />
  if (kind === 'workspace') return <FolderOpen size={14} strokeWidth={2} />
  return <Sparkles size={14} strokeWidth={2} />
}

export function SkillSlashPicker({ items, selectedIndex, onSelectIndex, onClose }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const selected = listRef.current?.querySelector(`[data-skill-index="${selectedIndex}"]`)
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

  if (items.length === 0) return null

  return (
    <div className={styles.skillSlashPicker} role="listbox" ref={listRef}>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          data-skill-index={index}
          className={`${styles.skillSlashItem}${index === selectedIndex ? ` ${styles.skillSlashItemSelected}` : ''}`}
          onMouseEnter={() => onSelectIndex(index)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => item.onSelect()}
        >
          <span className={styles.skillSlashIcon} aria-hidden>
            <SlashItemIcon kind={item.iconKind} />
          </span>
          <span className={styles.skillSlashName}>{item.name}</span>
          {item.description ? (
            <span className={styles.skillSlashDesc}>{item.description}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
