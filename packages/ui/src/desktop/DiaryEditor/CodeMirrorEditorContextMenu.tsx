import React, { useLayoutEffect, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { undo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { useTranslation } from 'react-i18next'
import { applyFixedContextMenuLayout } from '../ContextMenu/context-menu-placement.util'
import { DIARY_EDITOR_OVERLAY_Z } from '../../shared/diary-codemirror/editorOverlayZIndex'
import type { TextContextMenuState } from './codeMirrorEditor.types'

interface CodeMirrorEditorContextMenuProps {
  menu: TextContextMenuState | null
  onClose: () => void
  viewRef: React.RefObject<EditorView | null>
}

export function CodeMirrorEditorContextMenu({
  menu,
  onClose,
  viewRef
}: CodeMirrorEditorContextMenuProps) {
  const { t } = useTranslation()
  const cmMenuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (menu && cmMenuRef.current) {
      applyFixedContextMenuLayout(cmMenuRef.current, menu.x, menu.y)
    }
  }, [menu])

  useEffect(() => {
    const handleClose = () => onClose()
    window.addEventListener('click', handleClose)
    window.addEventListener('contextmenu', handleClose)
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('contextmenu', handleClose)
    }
  }, [onClose])

  if (!menu) return null

  return createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: DIARY_EDITOR_OVERLAY_Z.menuBackdrop,
          background: 'transparent'
        }}
        onMouseDown={onClose}
      />
      <div
        ref={cmMenuRef}
        className="cm-context-menu"
        style={{
          position: 'fixed',
          zIndex: DIARY_EDITOR_OVERLAY_Z.menu,
          left: menu.x,
          top: menu.y
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="cm-context-menu-item"
          disabled={!menu.hasSelection}
          onClick={() => {
            document.execCommand('copy')
            onClose()
          }}
        >
          {t('common.copy', '复制')}
        </button>
        <button
          className="cm-context-menu-item"
          disabled={!menu.hasSelection}
          onClick={() => {
            document.execCommand('cut')
            onClose()
          }}
        >
          {t('common.cut', '剪切')}
        </button>
        <button
          className="cm-context-menu-item"
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText()
              const view = viewRef.current
              if (view) {
                const { from, to } = view.state.selection.main
                view.dispatch({
                  changes: { from, to, insert: text },
                  selection: { anchor: from + text.length }
                })
                view.focus()
              }
            } catch (err) {
              console.error(err)
            }
            onClose()
          }}
        >
          {t('common.paste', '粘贴')}
        </button>
        <div className="cm-context-menu-divider" />
        <button
          className="cm-context-menu-item"
          onClick={() => {
            const view = viewRef.current
            if (view) {
              undo(view)
              view.focus()
            }
            onClose()
          }}
        >
          {t('common.undo', '撤销')}
        </button>
        <button
          className="cm-context-menu-item"
          onClick={() => {
            const view = viewRef.current
            if (view) {
              view.dispatch({
                selection: { anchor: 0, head: view.state.doc.length }
              })
              view.focus()
            }
            onClose()
          }}
        >
          {t('common.select_all', '全选')}
        </button>
      </div>
    </>,
    document.body
  )
}
