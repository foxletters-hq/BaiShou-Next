import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import type { NativeDiaryCodeMirrorEditorHandle } from './NativeDiaryCodeMirrorEditor'

export function useDiaryEditorInsert(params: {
  content: string
  editorRef: React.RefObject<NativeDiaryCodeMirrorEditorHandle | null>
  toolbarInsertingRef: React.MutableRefObject<boolean>
  syncFromMetrics: () => void
}) {
  const { content, editorRef, toolbarInsertingRef, syncFromMetrics } = params
  const contentRef = useRef(content)
  const selectionRef = useRef({ start: 0, end: 0 })
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null)
  contentRef.current = content

  const syncSelection = useCallback((sel: { start: number; end: number }) => {
    selectionRef.current = sel
  }, [])

  const prevContentLenRef = useRef(0)
  const contentHydratedRef = useRef(false)
  useEffect(() => {
    const grew = content.length > prevContentLenRef.current
    prevContentLenRef.current = content.length
    if (toolbarInsertingRef.current) return
    if (!contentHydratedRef.current) {
      if (content.length > 0) {
        contentHydratedRef.current = true
      }
      return
    }
    if (
      grew &&
      content.length > 0 &&
      selectionRef.current.start === 0 &&
      selectionRef.current.end === 0
    ) {
      syncSelection({ start: content.length, end: content.length })
    }
  }, [content, syncSelection, toolbarInsertingRef])

  const refocusEditor = useCallback(
    (sel: { start: number; end: number }) => {
      requestAnimationFrame(() => {
        editorRef.current?.focusAtOffset(sel.start)
        if (Platform.OS === 'android') {
          requestAnimationFrame(syncFromMetrics)
        }
      })
    },
    [editorRef, syncFromMetrics]
  )

  const insertAtPosition = useCallback(
    (start: number, end: number, snippet: string) => {
      const current = contentRef.current
      const safeStart = Math.max(0, Math.min(start, current.length))
      const safeEnd = Math.max(safeStart, Math.min(end, current.length))
      const cursor = safeStart + snippet.length
      const sel = { start: cursor, end: cursor }

      toolbarInsertingRef.current = true
      pendingSelectionRef.current = sel
      editorRef.current?.insertAtRange(safeStart, safeEnd, snippet)
      syncSelection(sel)
      refocusEditor(sel)
      requestAnimationFrame(() => {
        toolbarInsertingRef.current = false
      })
    },
    [editorRef, refocusEditor, syncSelection, toolbarInsertingRef]
  )

  const handleInsertText = useCallback(
    (prefix: string, suffix: string = '') => {
      const { start, end } = selectionRef.current
      const current = contentRef.current
      const selectedText = current.substring(start, end)
      insertAtPosition(start, end, prefix + selectedText + suffix)
    },
    [insertAtPosition]
  )

  const runEditorCommand = useCallback(
    (command: () => void) => {
      toolbarInsertingRef.current = true
      command()
      requestAnimationFrame(() => {
        toolbarInsertingRef.current = false
      })
    },
    [toolbarInsertingRef]
  )

  useEffect(() => {
    if (pendingSelectionRef.current) {
      const sel = pendingSelectionRef.current
      pendingSelectionRef.current = null
      syncSelection(sel)
    }
  }, [content, syncSelection])

  return {
    contentRef,
    selectionRef,
    syncSelection,
    insertAtPosition,
    handleInsertText,
    runEditorCommand
  }
}
