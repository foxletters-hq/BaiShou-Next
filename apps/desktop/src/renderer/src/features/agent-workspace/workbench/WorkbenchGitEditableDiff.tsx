import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { workbenchEditorTheme } from '@baishou/ui/shared/diary-codemirror'
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
  const leftRef = useRef<HTMLDivElement>(null)
  const editorHostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const suppressEchoRef = useRef(false)
  const syncing = useRef(false)

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
          })
        ]
      }),
      parent: host
    })
    viewRef.current = view

    return () => {
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

  return (
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
  )
}
