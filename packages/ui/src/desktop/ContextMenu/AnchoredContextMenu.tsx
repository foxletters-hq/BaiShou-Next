import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ContextMenu.css'
import { applyFixedContextMenuLayout, type ContextMenuBounds } from './context-menu-placement.util'
import { DIARY_EDITOR_OVERLAY_Z } from '../../shared/diary-codemirror/editorOverlayZIndex'
import type { ContextMenuItem } from './ContextMenu'
import { ContextMenuItemList } from './ContextMenuItemList'

export interface AnchoredContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
  backdropZIndex?: number
  menuZIndex?: number
  /** 默认使用通用 context-menu；日记历史样式可传 cm-context-menu */
  menuClassName?: string
  itemClassName?: string
  dividerClassName?: string
  /** 可选安全区；从输入框内打开时应用 getContextMenuBoundsForAnchor */
  bounds?: ContextMenuBounds
  /** 将 y 视为菜单底边，优先在锚点上方展开（避免盖住输入框） */
  preferAbove?: boolean
}

/**
 * 按屏幕坐标弹出的上下文菜单（无 children 触发器）。
 * 供编辑器 MenuRegistry Host、以及后续 Explorer/Table 复用。
 */
export function AnchoredContextMenu({
  x,
  y,
  items,
  onClose,
  backdropZIndex = DIARY_EDITOR_OVERLAY_Z.menuBackdrop,
  menuZIndex = DIARY_EDITOR_OVERLAY_Z.menu,
  menuClassName = 'context-menu',
  itemClassName = 'context-menu-item',
  dividerClassName = 'context-menu-divider',
  bounds,
  preferAbove = false
}: AnchoredContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [placed, setPlaced] = useState(false)

  useLayoutEffect(() => {
    if (!menuRef.current) return
    applyFixedContextMenuLayout(menuRef.current, x, y, bounds, { preferAbove })
    setPlaced(true)
  }, [x, y, items, bounds, preferAbove])

  useEffect(() => {
    const handleClose = () => onClose()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const timer = window.setTimeout(() => {
      window.addEventListener('click', handleClose)
    }, 0)
    window.addEventListener('contextmenu', handleClose)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('click', handleClose)
      window.removeEventListener('contextmenu', handleClose)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: backdropZIndex,
          background: 'transparent'
        }}
        onMouseDown={onClose}
      />
      <div
        ref={menuRef}
        className={`${menuClassName}${placed ? ' context-menu-ready' : ' context-menu-pending'}`}
        style={{
          position: 'fixed',
          zIndex: menuZIndex,
          left: x,
          top: y
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ContextMenuItemList
          items={items}
          onClose={onClose}
          itemClassName={itemClassName}
          dividerClassName={dividerClassName}
        />
      </div>
    </>,
    document.body
  )
}
