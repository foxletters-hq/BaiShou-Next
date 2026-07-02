import React, { useCallback, useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { createDiaryCodeMirror, type DiaryCmPlatform } from '@baishou/ui/shared/diary-codemirror'
import styles from './WorkbenchLivePreviewEditor.module.css'

export interface WorkbenchLivePreviewEditorProps {
  documentId: string
  content: string
  folderRoot: string
  onChange?: (content: string) => void
  readOnly?: boolean
}

export const WorkbenchLivePreviewEditor: React.FC<WorkbenchLivePreviewEditorProps> = ({
  documentId,
  content,
  folderRoot,
  onChange,
  readOnly = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const suppressEchoRef = useRef(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const resolveUrl = useCallback(
    (srcRaw: string): string => {
      if (/^(https?:|data:|local:\/\/)/i.test(srcRaw)) return srcRaw
      const normalizedRoot = folderRoot.replace(/\\/g, '/').replace(/\/$/, '')
      const normalizedSrc = srcRaw.replace(/^\.\//, '').replace(/\\/g, '/')
      return `local:///${normalizedRoot}/${normalizedSrc}`
    },
    [folderRoot]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const platform: DiaryCmPlatform = {
      resolveAttachmentUrl: resolveUrl,
      interactionMode: 'mouse'
    }

    const view = createDiaryCodeMirror(container, {
      content,
      platform,
      onChange: (next) => {
        if (suppressEchoRef.current || readOnly) return
        onChangeRef.current?.(next)
      },
      extraExtensions: readOnly ? [EditorState.readOnly.of(true)] : []
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreate editor per document
  }, [documentId, folderRoot, readOnly, resolveUrl])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === content) return
    suppressEchoRef.current = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content }
    })
    suppressEchoRef.current = false
  }, [content])

  return <div ref={containerRef} className={styles.editor} />
}
