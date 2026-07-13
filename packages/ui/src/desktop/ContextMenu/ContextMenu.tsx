import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import './ContextMenu.css'
import { applyFixedContextMenuLayout } from './context-menu-placement.util'
import { DIARY_EDITOR_OVERLAY_Z } from '../../shared/diary-codemirror/editorOverlayZIndex'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  divider?: boolean
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  children: React.ReactNode
  /** 默认 diary 编辑器菜单层；图片预览等更高浮层可传入更大值 */
  backdropZIndex?: number
  menuZIndex?: number
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  children,
  backdropZIndex = DIARY_EDITOR_OVERLAY_Z.menuBackdrop,
  menuZIndex = DIARY_EDITOR_OVERLAY_Z.menu
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPosition({ x: e.clientX, y: e.clientY })
    setIsOpen(true)
  }, [])

  useLayoutEffect(() => {
    if (isOpen && menuRef.current) {
      applyFixedContextMenuLayout(menuRef.current, position.x, position.y)
    }
  }, [isOpen, position, items])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleClose])

  return (
    <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
      {children}
      {isOpen &&
        createPortal(
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
              onMouseDown={handleClose}
            />
            <div
              ref={menuRef}
              className="context-menu"
              style={{
                position: 'fixed',
                zIndex: menuZIndex,
                left: position.x,
                top: position.y
              }}
            >
              {items.map((item, index) => {
                if (item.divider) {
                  return <div key={index} className="context-menu-divider" />
                }

                return (
                  <button
                    key={index}
                    className={`context-menu-item ${item.disabled ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!item.disabled) {
                        item.onClick()
                        handleClose()
                      }
                    }}
                    disabled={item.disabled}
                  >
                    {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                    <span className="context-menu-label">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  )
}
