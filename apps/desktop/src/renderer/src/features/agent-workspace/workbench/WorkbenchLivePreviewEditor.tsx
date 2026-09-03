import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  createDiaryCodeMirror,
  workbenchEditorTheme,
  placePreviewCursorPastHeading,
  placePreviewCursorAt,
  replaceEditorDocumentContent,
  type DiaryCmPlatform
} from '@baishou/ui/shared/diary-codemirror'
import { isSkillMarkdownPath } from '@baishou/shared'
import {
  editorContextMenuExtension,
  type EditorContextMenuOpenPayload
} from '@baishou/ui/shared/diary-codemirror'
import { EditorContextMenuHost } from '@baishou/ui/desktop/ContextMenu/EditorContextMenuHost'
import { workbenchSelectionAffordance, type WorkbenchSelectionAffordanceState } from '@baishou/ui'
import {
  getEditorViewSelectionLines,
  type WorkbenchEditorSelectionHandle
} from './workbench-editor-selection.util'
import styles from './WorkbenchLivePreviewEditor.module.css'

export interface WorkbenchLivePreviewEditorProps {
  documentId: string
  content: string
  folderRoot: string
  relativePath?: string
  scrollToLine?: number
  scrollToColumn?: number
  onScrolledToLine?: () => void
  onChange?: (content: string) => void
  readOnly?: boolean
  onSelectionAffordanceChange?: (state: WorkbenchSelectionAffordanceState | null) => void
}

export const WorkbenchLivePreviewEditor = forwardRef<
  WorkbenchEditorSelectionHandle,
  WorkbenchLivePreviewEditorProps
>(function WorkbenchLivePreviewEditor(
  {
    documentId,
    content,
    folderRoot,
    relativePath,
    scrollToLine,
    scrollToColumn,
    onScrolledToLine,
    onChange,
    readOnly = false,
    onSelectionAffordanceChange
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSelectionAffordanceChangeRef = useRef(onSelectionAffordanceChange)
  const suppressEchoRef = useRef(false)
  const pendingScrollRef = useRef<{ line: number; column?: number } | null>(null)
  const skipHeadingPlacementRef = useRef(false)
  const [textContextMenu, setTextContextMenu] = useState<EditorContextMenuOpenPayload | null>(null)

  useEffect(() => {
    if (scrollToLine) {
      pendingScrollRef.current = { line: scrollToLine, column: scrollToColumn }
      skipHeadingPlacementRef.current = true
      return
    }
    pendingScrollRef.current = null
  }, [scrollToLine, scrollToColumn])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onSelectionAffordanceChangeRef.current = onSelectionAffordanceChange
  }, [onSelectionAffordanceChange])

  useImperativeHandle(
    ref,
    () => ({
      getSelectionLines: () => getEditorViewSelectionLines(viewRef.current)
    }),
    []
  )

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
      interactionMode: 'mouse',
      documentProperties: relativePath ? isSkillMarkdownPath(relativePath) : false
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
        }),
        workbenchSelectionAffordance((state) => {
          onSelectionAffordanceChangeRef.current?.(state)
        })
      ]
    })
    viewRef.current = view
    const pending = pendingScrollRef.current
    skipHeadingPlacementRef.current = pending != null
    if (pending) {
      placePreviewCursorAt(view, pending.line, pending.column ?? 0)
      pendingScrollRef.current = null
    }
    requestAnimationFrame(() => {
      if (skipHeadingPlacementRef.current || pendingScrollRef.current) return
      placePreviewCursorPastHeading(view)
    })

    return () => {
      setTextContextMenu(null)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreate editor per document
  }, [documentId, folderRoot, readOnly, resolveUrl, relativePath])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    suppressEchoRef.current = true
    replaceEditorDocumentContent(view, content, { scrollIntoView: false })
    suppressEchoRef.current = false
  }, [content])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !scrollToLine) return
    placePreviewCursorAt(view, scrollToLine, scrollToColumn ?? 0)
    skipHeadingPlacementRef.current = true
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
})
