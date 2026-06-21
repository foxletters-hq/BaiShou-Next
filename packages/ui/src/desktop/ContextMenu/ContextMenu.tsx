import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import './ContextMenu.css'

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
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, children }) => {
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
      const rect = menuRef.current.getBoundingClientRect()
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      let adjustedX = position.x
      let adjustedY = position.y

      if (position.x + rect.width > windowWidth) {
        adjustedX = Math.max(10, windowWidth - rect.width - 10)
      }
      if (position.y + rect.height > windowHeight) {
        adjustedY = Math.max(10, windowHeight - rect.height - 10)
      }

      menuRef.current.style.left = `${adjustedX}px`
      menuRef.current.style.top = `${adjustedY}px`
    }
  }, [isOpen, position])

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
                zIndex: 9999,
                background: 'transparent'
              }}
              onMouseDown={handleClose}
            />
            <div
              ref={menuRef}
              className="context-menu"
              style={{
                position: 'fixed',
                zIndex: 10000,
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
