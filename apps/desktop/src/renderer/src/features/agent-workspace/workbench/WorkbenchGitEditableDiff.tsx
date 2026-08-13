import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  editorContextMenuExtension,
  workbenchEditorTheme,
  type EditorContextMenuOpenPayload
} from '@baishou/ui/shared/diary-codemirror'
import { AnchoredContextMenu, type ContextMenuItem, useToast } from '@baishou/ui'
import { EditorContextMenuHost } from '@baishou/ui/desktop/ContextMenu/EditorContextMenuHost'
import styles from './WorkbenchGitEditableDiff.module.css'

function splitLines(text: string): string[] {
  if (!text) return []
  const normalized = text.replace(/\r\n/g, '\n')
  if (!normalized) return []
  const lines = normalized.split('\n')
  if (lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

export interface WorkbenchGitEditableDiffProps {
  originalContent: string
  content: string
  onChange: (content: string) => void
}

export const WorkbenchGitEditableDiff: React.FC<WorkbenchGitEditableDiffProps> = ({
  originalContent,
  content,
  onChange
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const leftRef = useRef<HTMLDivElement>(null)
  const editorHostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const suppressEchoRef = useRef(false)
  const syncing = useRef(false)
  const [textContextMenu, setTextContextMenu] = useState<EditorContextMenuOpenPayload | null>(null)
  const [originalMenu, setOriginalMenu] = useState<{ x: number; y: number } | null>(null)

  const originalLines = useMemo(() => splitLines(originalContent), [originalContent])
  const isNewFile = originalLines.length === 0

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const host = editorHostRef.current
    if (!host) return

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          workbenchEditorTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || suppressEchoRef.current) return
            onChangeRef.current(update.state.doc.toString())
          }),
          editorContextMenuExtension({
            readOnly: false,
            onOpen: (payload) => setTextContextMenu(payload)
          })
        ]
      }),
      parent: host
    })
    viewRef.current = view

    return () => {
      setTextContextMenu(null)
      view.destroy()
      viewRef.current = null
    }
    // Mount once; content changes sync via the effect below (avoid recreating EditorView).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- content
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === content) return
    suppressEchoRef.current = true
    view.dispatch({
      changes: { from: 0, to: current.length, insert: content }
    })
    suppressEchoRef.current = false
  }, [content])

  const syncScroll = useCallback((source: HTMLElement, target: HTMLElement | null) => {
    if (!target || syncing.current) return
    syncing.current = true
    target.scrollTop = source.scrollTop
    requestAnimationFrame(() => {
      syncing.current = false
    })
  }, [])

  const onEditorScroll = useCallback(() => {
    const view = viewRef.current
    const left = leftRef.current
    if (!view || !left) return
    syncScroll(view.scrollDOM, left)
  }, [syncScroll])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.scrollDOM.addEventListener('scroll', onEditorScroll)
    return () => view.scrollDOM.removeEventListener('scroll', onEditorScroll)
  }, [onEditorScroll])

  const originalMenuItems = useMemo((): ContextMenuItem[] => {
    return [
      {
        label: t('common.copy', '复制'),
        onClick: () => {
          const selected = window.getSelection()?.toString()
          const text = selected?.trim() ? selected : originalContent
          void navigator.clipboard.writeText(text).then(
            () => toast.showSuccess(t('common.copied', '已复制到剪贴板')),
            () => toast.showError(t('common.copy_failed', '复制失败'))
          )
        }
      }
    ]
  }, [originalContent, t, toast])

  return (
    <>
      <div className={styles.root}>
        <div className={styles.header}>
          <div className={styles.headerCell}>{t('workbench.diff_original', '原始')}</div>
          <div className={styles.headerCell}>{t('workbench.diff_modified', '修改后')}</div>
        </div>
        <div className={styles.body}>
          <div
            ref={leftRef}
            className={`${styles.pane} ${styles.readonlyPane}`}
            onScroll={(event) => {
              const view = viewRef.current
              if (!view) return
              syncScroll(event.currentTarget, view.scrollDOM)
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              setOriginalMenu({ x: event.clientX, y: event.clientY })
            }}
          >
            {isNewFile ? (
              <div className={styles.emptyOriginal}>
                {t('workbench.diff_original_empty', '（新文件，HEAD 中无此内容）')}
              </div>
            ) : (
              originalLines.map((line, index) => (
                <div key={index} className={styles.lineRow}>
                  <span className={styles.lineNum}>{index + 1}</span>
                  <span className={styles.lineText}>{line}</span>
                </div>
              ))
            )}
          </div>
          <div className={`${styles.pane} ${styles.editorPane}`}>
            <div ref={editorHostRef} className={styles.editorHost} />
          </div>
        </div>
        <div className={styles.hint}>
          {t('workbench.git_diff_editable_hint', '右侧可直接编辑，保存后自动写入工作区文件')}
        </div>
      </div>
      <EditorContextMenuHost
        menu={textContextMenu}
        onClose={() => setTextContextMenu(null)}
        variant="context-menu"
      />
      {originalMenu ? (
        <AnchoredContextMenu
          x={originalMenu.x}
          y={originalMenu.y}
          items={originalMenuItems}
          onClose={() => setOriginalMenu(null)}
        />
      ) : null}
    </>
  )
}
