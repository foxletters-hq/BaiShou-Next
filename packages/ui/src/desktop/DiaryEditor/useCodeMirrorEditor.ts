import { useImperativeHandle, useState } from 'react'
import { undo, redo } from '@codemirror/commands'
import { useTranslation } from 'react-i18next'
import { toggleMarkdownMark } from '../../shared/diary-codemirror/extensions/keymap'
import type { DiaryCmMarkdownMark } from '../../shared/diary-codemirror/types'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import type { CodeMirrorEditorHandle, CodeMirrorEditorProps } from './codeMirrorEditor.types'
import { useCodeMirrorEditorView } from './useCodeMirrorEditorView'
import { useCodeMirrorImageCallbacks } from './useCodeMirrorImageCallbacks'
import { useCodeMirrorFileTransfer } from './useCodeMirrorFileTransfer'

export function useCodeMirrorEditor(
  props: CodeMirrorEditorProps,
  ref: React.ForwardedRef<CodeMirrorEditorHandle>
) {
  const { t } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()

  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [textContextMenu, setTextContextMenu] = useState<{
    x: number
    y: number
    hasSelection: boolean
  } | null>(null)

  const { containerRef, viewRef } = useCodeMirrorEditorView(
    props,
    setPreviewSrc,
    setTextContextMenu
  )

  useCodeMirrorImageCallbacks(viewRef, toast, dialog, t)

  const { handleDragOver, handleDrop, handlePaste } = useCodeMirrorFileTransfer(
    viewRef,
    props.onPasteFiles,
    props.onDropFiles
  )

  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor: (text: string) => {
        const view = viewRef.current
        if (!view) return
        const { from } = view.state.selection.main
        view.dispatch({
          changes: { from, insert: text },
          selection: { anchor: from + text.length }
        })
        view.focus()
      },
      insertWrappedText: (prefix: string, suffix = '') => {
        const view = viewRef.current
        if (!view) return
        const { from, to } = view.state.selection.main
        const selected = view.state.sliceDoc(from, to)
        view.dispatch({
          changes: { from, to, insert: prefix + selected + suffix },
          selection: { anchor: from + prefix.length, head: to + prefix.length }
        })
        view.focus()
      },
      undo: () => {
        const view = viewRef.current
        if (!view) return
        undo(view)
        view.focus()
      },
      redo: () => {
        const view = viewRef.current
        if (!view) return
        redo(view)
        view.focus()
      },
      toggleMarkdownMark: (marker: DiaryCmMarkdownMark) => {
        const view = viewRef.current
        if (!view) return
        toggleMarkdownMark(view, marker)
        view.focus()
      },
      focus: () => {
        viewRef.current?.focus()
      }
    }),
    [viewRef]
  )

  return {
    containerRef,
    viewRef,
    previewSrc,
    setPreviewSrc,
    textContextMenu,
    setTextContextMenu,
    handleDragOver,
    handleDrop,
    handlePaste
  }
}
