import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ContextMenuItem } from './ContextMenu'

export interface ContextMenuItemListProps {
  items: ContextMenuItem[]
  onClose: () => void
  itemClassName?: string
  dividerClassName?: string
  /** 子菜单层级，用于 z-index 与定位 */
  depth?: number
}

/**
 * 可递归渲染的菜单项列表，支持悬停展开 children 二级菜单。
 */
export function ContextMenuItemList({
  items,
  onClose,
  itemClassName = 'context-menu-item',
  dividerClassName = 'context-menu-divider',
  depth = 0
}: ContextMenuItemListProps) {
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleCloseSubmenu = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpenSubmenuIndex(null)
    }, 120)
  }, [clearCloseTimer])

  const openSubmenu = useCallback(
    (index: number) => {
      clearCloseTimer()
      setOpenSubmenuIndex(index)
    },
    [clearCloseTimer]
  )

  return (
    <>
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`sep-${depth}-${index}`} className={dividerClassName} />
        }

        const hasChildren = Boolean(item.children && item.children.length > 0)
        const isSubmenuOpen = openSubmenuIndex === index

        return (
          <div
            key={`item-${depth}-${index}-${item.label}`}
            className={`context-menu-item-wrap${isSubmenuOpen ? ' is-submenu-open' : ''}`}
            onMouseEnter={() => {
              if (hasChildren) openSubmenu(index)
              else {
                clearCloseTimer()
                setOpenSubmenuIndex(null)
              }
            }}
            onMouseLeave={() => {
              if (hasChildren) scheduleCloseSubmenu()
            }}
          >
            <button
              type="button"
              className={`${itemClassName}${item.disabled ? ' disabled' : ''}${hasChildren ? ' has-submenu' : ''}`}
              disabled={item.disabled}
              aria-haspopup={hasChildren ? 'menu' : undefined}
              aria-expanded={hasChildren ? isSubmenuOpen : undefined}
              onMouseDown={(e) => {
                // 避免抢走输入框/contenteditable 的选区（Skill 斜杠插入依赖选区）
                e.preventDefault()
              }}
              onClick={() => {
                if (item.disabled) return
                if (hasChildren) {
                  openSubmenu(index)
                  return
                }
                item.onClick?.()
                if (!item.keepOpen) onClose()
              }}
            >
              {item.icon && <span className="context-menu-icon">{item.icon}</span>}
              <span className="context-menu-label">{item.label}</span>
              {hasChildren ? (
                <span className="context-menu-chevron" aria-hidden>
                  <ChevronRight size={14} strokeWidth={2} />
                </span>
              ) : null}
            </button>
            {hasChildren && isSubmenuOpen ? (
              <ContextMenuSubmenu
                items={item.children!}
                onClose={onClose}
                itemClassName={itemClassName}
                dividerClassName={dividerClassName}
                depth={depth + 1}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={scheduleCloseSubmenu}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

function ContextMenuSubmenu({
  items,
  onClose,
  itemClassName,
  dividerClassName,
  depth,
  onMouseEnter,
  onMouseLeave
}: {
  items: ContextMenuItem[]
  onClose: () => void
  itemClassName?: string
  dividerClassName?: string
  depth: number
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState<'right' | 'left'>('right')
  const [placed, setPlaced] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return

    const parentRect = parent.getBoundingClientRect()
    const submenuWidth = el.offsetWidth || 200
    const spaceRight = window.innerWidth - parentRect.right
    const nextSide: 'right' | 'left' = spaceRight < submenuWidth + 8 ? 'left' : 'right'
    setSide(nextSide)

    // 先按左右写 class，再量高度（同一帧内同步改 DOM，避免先闪再挪）
    el.classList.toggle('context-menu-submenu-right', nextSide === 'right')
    el.classList.toggle('context-menu-submenu-left', nextSide === 'left')

    const margin = 8
    const preferredMax = 320
    const spaceBelow = Math.max(0, window.innerHeight - parentRect.top - margin)
    const spaceAbove = Math.max(0, parentRect.bottom - margin)
    const maxHeight = Math.max(96, Math.min(preferredMax, Math.max(spaceBelow, spaceAbove)))
    el.style.maxHeight = `${maxHeight}px`

    // 默认与父项顶对齐；若底部溢出则上移，并保证顶边不超出视口
    el.style.top = '-4px'
    const rect = el.getBoundingClientRect()
    let topPx = -4
    if (rect.bottom > window.innerHeight - margin) {
      topPx = -4 - (rect.bottom - (window.innerHeight - margin))
    }
    if (rect.top + (topPx - -4) < margin) {
      // 顶边顶到视口时，尽量向下对齐可用空间
      const shiftedTop = margin - parentRect.top
      topPx = Math.min(topPx, shiftedTop)
    }
    el.style.top = `${topPx}px`
    setPlaced(true)
  }, [items])

  return (
    <div
      ref={ref}
      className={`context-menu context-menu-submenu context-menu-submenu-${side}${
        placed ? ' context-menu-ready' : ' context-menu-pending'
      }`}
      role="menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ContextMenuItemList
        items={items}
        onClose={onClose}
        itemClassName={itemClassName}
        dividerClassName={dividerClassName}
        depth={depth}
      />
    </div>
  )
}
