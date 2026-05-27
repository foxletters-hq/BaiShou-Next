import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import './ContextMenu.css'

export const GlobalInputContextMenu: React.FC = () => {
  const { t } = useTranslation()
  const [targetEl, setTargetEl] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [hasSelection, setHasSelection] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Check if it's a standard text input/textarea
      const isTextInput =
        (target instanceof HTMLInputElement &&
          ['text', 'password', 'email', 'search', 'url', 'tel'].includes(target.type)) ||
        target instanceof HTMLTextAreaElement

      // Avoid overriding CodeMirror or custom menus
      if (isTextInput && !target.closest('.cm-editor') && !target.closest('.cm-content')) {
        e.preventDefault()
        const textEl = target as HTMLInputElement | HTMLTextAreaElement
        textEl.focus()
        setTargetEl(textEl)
        setPosition({ x: e.clientX, y: e.clientY })

        const start = textEl.selectionStart ?? 0
        const end = textEl.selectionEnd ?? 0
        setHasSelection(start !== end)
      } else {
        // Click elsewhere closes it
        setTargetEl(null)
      }
    }

    const handleClose = () => {
      setTargetEl(null)
    }

    window.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('click', handleClose)
    window.addEventListener('mousedown', handleClose)

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('click', handleClose)
      window.removeEventListener('mousedown', handleClose)
    }
  }, [])

  useLayoutEffect(() => {
    if (targetEl && menuRef.current) {
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
  }, [targetEl, position])

  if (!targetEl) return null

  const isReadOnly = targetEl.readOnly || targetEl.disabled

  const handleCopy = () => {
    const start = targetEl.selectionStart ?? 0
    const end = targetEl.selectionEnd ?? 0
    const selectedText = targetEl.value.substring(start, end)
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
    }
    setTargetEl(null)
  }

  const handleCut = () => {
    if (isReadOnly) return
    const start = targetEl.selectionStart ?? 0
    const end = targetEl.selectionEnd ?? 0
    const val = targetEl.value
    const selectedText = val.substring(start, end)
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
      targetEl.value = val.substring(0, start) + val.substring(end)
      targetEl.selectionStart = targetEl.selectionEnd = start

      // Trigger React state change
      const tracker = (targetEl as any)._valueTracker
      if (tracker) {
        tracker.setValue(val)
      }
      targetEl.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setTargetEl(null)
  }

  const handlePaste = async () => {
    if (isReadOnly) return
    try {
      const text = await navigator.clipboard.readText()
      const start = targetEl.selectionStart ?? 0
      const end = targetEl.selectionEnd ?? 0
      const val = targetEl.value
      targetEl.value = val.substring(0, start) + text + val.substring(end)
      targetEl.selectionStart = targetEl.selectionEnd = start + text.length

      // Trigger React state change
      const tracker = (targetEl as any)._valueTracker
      if (tracker) {
        tracker.setValue(val)
      }
      targetEl.dispatchEvent(new Event('input', { bubbles: true }))
    } catch (err) {
      console.error(err)
    }
    setTargetEl(null)
  }

  const handleSelectAll = () => {
    targetEl.select()
    setTargetEl(null)
  }

  return createPortal(
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
        onMouseDown={() => setTargetEl(null)}
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
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="context-menu-item" onClick={handleCopy} disabled={!hasSelection}>
          <span className="context-menu-label">{t('common.copy', '复制')}</span>
          <span className="context-menu-shortcut">Ctrl+C</span>
        </button>
        <button
          className="context-menu-item"
          onClick={handleCut}
          disabled={!hasSelection || isReadOnly}
        >
          <span className="context-menu-label">{t('common.cut', '剪切')}</span>
          <span className="context-menu-shortcut">Ctrl+X</span>
        </button>
        <button className="context-menu-item" onClick={handlePaste} disabled={isReadOnly}>
          <span className="context-menu-label">{t('common.paste', '粘贴')}</span>
          <span className="context-menu-shortcut">Ctrl+V</span>
        </button>
        <div className="context-menu-divider" />
        <button className="context-menu-item" onClick={handleSelectAll}>
          <span className="context-menu-label">{t('common.select_all', '全选')}</span>
          <span className="context-menu-shortcut">Ctrl+A</span>
        </button>
      </div>
    </>,
    document.body
  )
}
