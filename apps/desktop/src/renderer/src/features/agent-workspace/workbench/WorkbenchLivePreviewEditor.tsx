import React, { useCallback, useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  createDiaryCodeMirror,
  workbenchEditorTheme,
  placePreviewCursorPastHeading,
  placePreviewCursorAt,
  type DiaryCmPlatform
} from '@baishou/ui/shared/diary-codemirror'
import {
  editorContextMenuExtension,
  type EditorContextMenuOpenPayload
} from '@baishou/ui/shared/diary-codemirror'
import { EditorContextMenuHost } from '@baishou/ui/desktop/ContextMenu/EditorContextMenuHost'
import styles from './WorkbenchLivePreviewEditor.module.css'

export interface WorkbenchLivePreviewEditorProps {
  documentId: string
  content: string
  folderRoot: string
  scrollToLine?: number
  scrollToColumn?: number
  onScrolledToLine?: () => void
  onChange?: (content: string) => void
  readOnly?: boolean
}

export const WorkbenchLivePreviewEditor: React.FC<WorkbenchLivePreviewEditorProps> = ({
  documentId,
  content,
  folderRoot,
  scrollToLine,
  scrollToColumn,
  onScrolledToLine,
  onChange,
  readOnly = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const suppressEchoRef = useRef(false)
  const pendingScrollRef = useRef<{ line: number; column?: number } | null>(null)
  const [textContextMenu, setTextContextMenu] = useState<EditorContextMenuOpenPayload | null>(
    null
  )

  useEffect(() => {
    if (scrollToLine) {
      pendingScrollRef.current = { line: scrollToLine, column: scrollToColumn }
    }
  }, [scrollToLine, scrollToColumn])

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
      extraExtensions: [
        workbenchEditorTheme,
        EditorView.editorAttributes.of({ class: 'workbench-cm-editor' }),
        ...(readOnly ? [EditorState.readOnly.of(true)] : []),
        editorContextMenuExtension({
          readOnly,
          docUri: documentId,
          onOpen: (payload) => setTextContextMenu(payload)
        })
      ]
    })
    viewRef.current = view
    requestAnimationFrame(() => {
      if (pendingScrollRef.current) return
      placePreviewCursorPastHeading(view)
    })

    return () => {
      setTextContextMenu(null)
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

  useEffect(() => {
    const view = viewRef.current
    if (!view || !scrollToLine) return
    placePreviewCursorAt(view, scrollToLine, scrollToColumn ?? 0)
    pendingScrollRef.current = null
    onScrolledToLine?.()
  }, [content, documentId, onScrolledToLine, scrollToColumn, scrollToLine])

  return (
    <>
      <div ref={containerRef} className={`workbench-cm-editor ${styles.editor}`} />
      <EditorContextMenuHost
        menu={textContextMenu}
        onClose={() => setTextContextMenu(null)}
        variant="context-menu"
      />
    </>
  )
}
