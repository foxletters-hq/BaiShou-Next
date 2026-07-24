import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorView } from '@codemirror/view'
import {
  createDiaryCodeMirror,
  editorContextMenuExtension,
  forceImageRefresh,
  type DiaryCmPlatform
} from '../../shared/diary-codemirror'
import { replaceEditorDocumentContent } from '../../shared/diary-codemirror/editorContentSync'
import type { CodeMirrorEditorProps, TextContextMenuState } from './codeMirrorEditor.types'

function scheduleEditorMount(callback: () => void): () => void {
  if (typeof requestIdleCallback !== 'undefined') {
    const idleId = requestIdleCallback(callback, { timeout: 120 })
    return () => cancelIdleCallback(idleId)
  }

  const rafId = requestAnimationFrame(() => {
    requestAnimationFrame(callback)
  })
  return () => cancelAnimationFrame(rafId)
}

export function useCodeMirrorEditorView(
  props: Pick<CodeMirrorEditorProps, 'content' | 'placeholder' | 'basePath' | 'onChange'>,
  setPreviewSrc: (src: string | null) => void,
  setTextContextMenu: (menu: TextContextMenuState | null) => void
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(props.onChange)
  const basePathRef = useRef(props.basePath)
  const contentRef = useRef(props.content)
  /** 程序化写入正文时不向上层回传 change，避免误判为「用户已修改」 */
  const suppressChangeEchoRef = useRef(false)
  const { t } = useTranslation()
  const translateRef = useRef(t)

  useEffect(() => {
    onChangeRef.current = props.onChange
  }, [props.onChange])

  useEffect(() => {
    translateRef.current = t
  }, [t])

  useEffect(() => {
    basePathRef.current = props.basePath
  }, [props.basePath])

  useEffect(() => {
    contentRef.current = props.content
  }, [props.content])

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

    let cancelled = false
    let view: EditorView | null = null

    const cancelScheduledMount = scheduleEditorMount(() => {
      if (cancelled || !containerRef.current) return

      const platform: DiaryCmPlatform = {
        resolveAttachmentUrl: resolveUrl,
        interactionMode: 'mouse',
        tagLineMode: true,
        onExternalImagePreview: (src) => setPreviewSrc(src),
        translate: (key, defaultValue) =>
          translateRef.current(key, { defaultValue: defaultValue || key })
      }

      view = createDiaryCodeMirror(containerRef.current, {
        content: contentRef.current,
        placeholder: props.placeholder,
        platform,
        onChange: (content) => {
          if (suppressChangeEchoRef.current) return
          onChangeRef.current(content)
        },
        extraExtensions: [
          editorContextMenuExtension({
            onOpen: (payload) => setTextContextMenu(payload)
          })
        ]
      })

      viewRef.current = view
      if (typeof window !== 'undefined') {
        window.__diaryTableDesktopDebug = true
      }

      const latestContent = contentRef.current
      if (latestContent !== view.state.doc.toString()) {
        suppressChangeEchoRef.current = true
        try {
          replaceEditorDocumentContent(view, latestContent)
        } finally {
          suppressChangeEchoRef.current = false
        }
      }

      requestAnimationFrame(() => {
        if (cancelled || viewRef.current !== view) return
        view.focus()
      })
    })

    return () => {
      cancelled = true
      cancelScheduledMount()
      view?.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (props.content !== view.state.doc.toString()) {
      suppressChangeEchoRef.current = true
      try {
        replaceEditorDocumentContent(view, props.content)
      } finally {
        suppressChangeEchoRef.current = false
      }
    }
  }, [props.content])

  return { containerRef, viewRef, basePathRef }
}
