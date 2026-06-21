import { useCallback, useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  highlightActiveLine
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap } from '@codemirror/search'
import {
  livePreviewPlugin,
  livePreviewSyntaxHighlighting,
  forceImageRefresh
} from './codeMirrorDecorations'
import { markdownKeymap } from './codeMirrorEditor.keymap'
import { editorTheme } from './codeMirrorTheme'
import { attachmentUrlPlugin } from './codeMirrorAttachmentPlugin'
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

    const extensions = [
      EditorView.lineWrapping,
      highlightActiveLine(),
      history(),
      markdownKeymap,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      markdown({ base: markdownLanguage }),
      cmPlaceholder(props.placeholder || ''),
      livePreviewPlugin(resolveUrl),
      livePreviewSyntaxHighlighting(),
      attachmentUrlPlugin(resolveUrl),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString())
        }
      }),
      EditorView.domEventHandlers({
        click: (event) => {
          const target = event.target as HTMLElement
          if (target.closest('.cm-image-container')) {
            return false
          }
          if (target.tagName === 'IMG') {
            const src = (target as HTMLImageElement).src
            if (src && !src.startsWith('attachment/')) {
              setPreviewSrc(src)
            }
          }
          return false
        },
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
      }),
      editorTheme
    ]

    const state = EditorState.create({
      doc: props.content,
      extensions
    })

    const view = new EditorView({ state, parent: container })
    viewRef.current = view

    const docLength = state.doc.length
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
