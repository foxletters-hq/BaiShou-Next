import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './ContextMenu.css'
import { applyFixedContextMenuLayout } from './context-menu-placement.util'
import { DIARY_EDITOR_OVERLAY_Z } from '../../shared/diary-codemirror/editorOverlayZIndex'
import type { ContextMenuItem } from './ContextMenu'

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
  dividerClassName = 'context-menu-divider'
}: AnchoredContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (menuRef.current) {
      applyFixedContextMenuLayout(menuRef.current, x, y)
    }
  }, [x, y, items])

  useEffect(() => {
    const handleClose = () => onClose()
    window.addEventListener('click', handleClose)
    window.addEventListener('contextmenu', handleClose)
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('contextmenu', handleClose)
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
        className={menuClassName}
        style={{
          position: 'fixed',
          zIndex: menuZIndex,
          left: x,
          top: y
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.map((item, index) => {
          if (item.divider) {
            return <div key={`sep-${index}`} className={dividerClassName} />
          }

          return (
            <button
              key={`item-${index}-${item.label}`}
              className={`${itemClassName}${item.disabled ? ' disabled' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                item.onClick()
                onClose()
              }}
            >
              {item.icon && <span className="context-menu-icon">{item.icon}</span>}
              <span className="context-menu-label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </>,
    document.body
  )
}
