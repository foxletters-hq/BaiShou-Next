import { useCallback, useEffect, useRef } from 'react'
import type { EditorView } from '@codemirror/view'
import type { CodeMirrorEditorProps } from './codeMirrorEditor.types'

export function useCodeMirrorFileTransfer(
  viewRef: React.RefObject<EditorView | null>,
  onPasteFiles?: CodeMirrorEditorProps['onPasteFiles'],
  onDropFiles?: CodeMirrorEditorProps['onDropFiles']
) {
  const onPasteFilesRef = useRef(onPasteFiles)
  const onDropFilesRef = useRef(onDropFiles)

  useEffect(() => {
    onPasteFilesRef.current = onPasteFiles
  }, [onPasteFiles])

  useEffect(() => {
    onDropFilesRef.current = onDropFiles
  }, [onDropFiles])

  const insertMarkdownAtCursor = useCallback(
    (markdowns: string[]) => {
      const view = viewRef.current
      if (!view) return
      const insertText = markdowns.join('\n\n') + '\n\n'
      const { from } = view.state.selection.main
      view.dispatch({
        changes: { from, insert: insertText },
        selection: { anchor: from + insertText.length }
      })
      view.focus()
    },
    [viewRef]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const dropHandler = onDropFilesRef.current || onPasteFilesRef.current
      if (!dropHandler) return

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      try {
        const markdowns = await dropHandler(files)
        insertMarkdownAtCursor(markdowns)
      } catch (err) {
        console.error('Failed to handle dropped files:', err)
      }
    },
    [insertMarkdownAtCursor]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const pasteHandler = onPasteFilesRef.current
      if (!pasteHandler) return

      const items = e.clipboardData.items
      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length === 0) return

      e.preventDefault()
      e.stopPropagation()

      try {
        const markdowns = await pasteHandler(files)
        insertMarkdownAtCursor(markdowns)
      } catch (err) {
        console.error('Failed to paste files:', err)
      }
    },
    [insertMarkdownAtCursor]
  )

  return { handleDragOver, handleDrop, handlePaste }
}
