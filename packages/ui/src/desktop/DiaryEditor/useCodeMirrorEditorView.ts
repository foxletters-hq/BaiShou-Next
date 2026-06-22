import { useCallback, useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import {
  createDiaryCodeMirror,
  forceImageRefresh,
  type DiaryCmPlatform
} from '../../shared/diary-codemirror'
import type { CodeMirrorEditorProps, TextContextMenuState } from './codeMirrorEditor.types'

export function useCodeMirrorEditorView(
  props: Pick<CodeMirrorEditorProps, 'content' | 'placeholder' | 'basePath' | 'onChange'>,
  setPreviewSrc: (src: string | null) => void,
  setTextContextMenu: (menu: TextContextMenuState | null) => void
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(props.onChange)
  const basePathRef = useRef(props.basePath)

  useEffect(() => {
    onChangeRef.current = props.onChange
  }, [props.onChange])

  useEffect(() => {
    basePathRef.current = props.basePath
  }, [props.basePath])

  const resolveUrl = useCallback((fileName: string): string => {
    const currentBasePath = basePathRef.current
    if (!currentBasePath) return fileName
    const normalizedBase = currentBasePath.replace(/\\/g, '/')
    const normalizedName = fileName.replace('attachment/', '')
    return `local:///${normalizedBase}/${normalizedName}`
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !props.basePath) return
    view.dispatch({ effects: forceImageRefresh.of(null) })
  }, [props.basePath])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const platform: DiaryCmPlatform = {
      resolveAttachmentUrl: resolveUrl,
      interactionMode: 'mouse',
      onExternalImagePreview: (src) => setPreviewSrc(src)
    }

    const view = createDiaryCodeMirror(container, {
      content: props.content,
      placeholder: props.placeholder,
      platform,
      onChange: (content) => onChangeRef.current(content),
      extraExtensions: [
        EditorView.domEventHandlers({
          contextmenu: (event, view) => {
            const target = event.target as HTMLElement
            if (target.closest('.cm-image-container')) {
              return false
            }

            event.preventDefault()
            event.stopPropagation()

            const { from, to } = view.state.selection.main
            setTextContextMenu({
              x: event.clientX,
              y: event.clientY,
              hasSelection: from !== to
            })
            return true
          }
        })
      ]
    })

    viewRef.current = view

    const docLength = view.state.doc.length
    view.dispatch({
      selection: { anchor: docLength, head: docLength }
    })
    view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (props.content !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: props.content
        }
      })
    }
  }, [props.content])

  return { containerRef, viewRef, basePathRef }
}
