import { useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
