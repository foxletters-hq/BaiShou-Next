import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect
} from 'react'
import { createPortal } from 'react-dom'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  highlightActiveLine
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, undo } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap } from '@codemirror/search'
import { ImagePreview } from './ImagePreview'
import {
  livePreviewPlugin,
  livePreviewSyntaxHighlighting,
  forceImageRefresh,
  setUpdateImageWidthCallback,
  setImageActionCallback
} from './codeMirrorDecorations'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import { editorTheme } from './codeMirrorTheme'
import { attachmentUrlPlugin } from './codeMirrorAttachmentPlugin'
// Legacy reference for integration tests: processAttachments, attachment/
import { parseImageMarkdown, buildImageMarkdown } from './image-utils'

export interface CodeMirrorEditorHandle {
  insertAtCursor: (text: string) => void
}

interface CodeMirrorEditorProps {
  content: string
  onChange: (value: string) => void
  placeholder?: string
  basePath?: string
  onPasteFiles?: (files: File[]) => Promise<string[]>
  onDropFiles?: (files: File[]) => Promise<string[]>
}

function toggleMarkdownMark(view: EditorView, marker: string): boolean {
  const { from, to } = view.state.selection.main
  const selText = view.state.sliceDoc(from, to)
  const mLen = marker.length

  // 选中文字：用 marker 包裹
  if (selText.length > 0) {
    // 检查选区外侧是否已被该标记包裹 → 是则去掉
    const before = view.state.sliceDoc(Math.max(0, from - mLen), from)
    const after = view.state.sliceDoc(to, to + mLen)
    if (before === marker && after === marker) {
      view.dispatch({
        changes: [
          { from: to, to: to + mLen },
          { from: from - mLen, to: from }
        ],
        selection: { anchor: from - mLen, head: to }
      })
    } else {
      view.dispatch({
        changes: { from, to, insert: `${marker}${selText}${marker}` },
        selection: { anchor: from + mLen, head: to + mLen }
      })
    }
    return true
  }

  // 无选中：插入标记对，光标居中
  view.dispatch({
    changes: { from, insert: `${marker}${marker}` },
    selection: { anchor: from + mLen }
  })
  return true
}

const markdownKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => toggleMarkdownMark(v, '**') },
  { key: 'Mod-i', run: (v) => toggleMarkdownMark(v, '*') },
  { key: 'Mod-`', run: (v) => toggleMarkdownMark(v, '`') }
])

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(
  function CodeMirrorEditor(
    { content, onChange, placeholder, basePath, onPasteFiles, onDropFiles },
    ref
  ) {
    const { t } = useTranslation()
    const toast = useToast()
    const dialog = useDialog()

    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onPasteFilesRef = useRef(onPasteFiles)
    const onDropFilesRef = useRef(onDropFiles)
    const [previewSrc, setPreviewSrc] = useState<string | null>(null)
    const [textContextMenu, setTextContextMenu] = useState<{
      x: number
      y: number
      hasSelection: boolean
    } | null>(null)
    const cmMenuRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
      if (textContextMenu && cmMenuRef.current) {
        const rect = cmMenuRef.current.getBoundingClientRect()
        const windowWidth = window.innerWidth
        const windowHeight = window.innerHeight

        let adjustedX = textContextMenu.x
        let adjustedY = textContextMenu.y

        if (textContextMenu.x + rect.width > windowWidth) {
          adjustedX = Math.max(10, windowWidth - rect.width - 10)
        }
        if (textContextMenu.y + rect.height > windowHeight) {
          adjustedY = Math.max(10, windowHeight - rect.height - 10)
        }

        cmMenuRef.current.style.left = `${adjustedX}px`
        cmMenuRef.current.style.top = `${adjustedY}px`
      }
    }, [textContextMenu])

    useEffect(() => {
      const handleClose = () => setTextContextMenu(null)
      window.addEventListener('click', handleClose)
      window.addEventListener('contextmenu', handleClose)
      return () => {
        window.removeEventListener('click', handleClose)
        window.removeEventListener('contextmenu', handleClose)
      }
    }, [])

    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
      onPasteFilesRef.current = onPasteFiles
    }, [onPasteFiles])

    useEffect(() => {
      onDropFilesRef.current = onDropFiles
    }, [onDropFiles])

    const basePathRef = useRef(basePath)
    useEffect(() => {
      basePathRef.current = basePath
    }, [basePath])

    useEffect(() => {
      const view = viewRef.current
      if (!view || !basePath) return
      view.dispatch({ effects: forceImageRefresh.of(null) })
    }, [basePath])

    const resolveUrl = useCallback((fileName: string): string => {
      const currentBasePath = basePathRef.current
      if (!currentBasePath) return fileName
      const normalizedBase = currentBasePath.replace(/\\/g, '/')
      const normalizedName = fileName.replace('attachment/', '')
      return `local:///${normalizedBase}/${normalizedName}`
    }, [])

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
      []
    )

    // 设置图片宽度更新回调
    useEffect(() => {
      setUpdateImageWidthCallback((from: number, to: number, newWidth: number) => {
        const view = viewRef.current
        if (!view) return

        const text = view.state.sliceDoc(from, to)
        const parsed = parseImageMarkdown(text, from)
        if (!parsed) return

        const newMarkdown = buildImageMarkdown(parsed.alt, parsed.src, newWidth)
        view.dispatch({
          changes: { from, to, insert: newMarkdown }
        })
      })
    }, [])

    // 设置图片右键操作回调
    useEffect(() => {
      setImageActionCallback(async (action, from, to, src) => {
        const view = viewRef.current
        if (!view) return

        const isLocal = src.startsWith('local:///')
        if (!isLocal) return

        const normalizedPath = decodeURIComponent(src.replace('local:///', ''))

        if (action === 'copy') {
          try {
            const res = await (window as any).api?.diary?.copyAttachment(normalizedPath)
            if (res?.success) {
              toast.showSuccess(t('markdown.copy_image_success', '图片已复制到剪贴板'))
            } else {
              toast.showError(res?.error || t('markdown.copy_image_failed', '复制失败'))
            }
          } catch (err: any) {
            toast.showError(err.message)
          }
        } else if (action === 'open') {
          try {
            await (window as any).api?.diary?.openAttachmentFolder(normalizedPath)
          } catch (err: any) {
            toast.showError(err.message)
          }
        } else if (action === 'delete') {
          const confirmed = await dialog.confirm(
            t(
              'markdown.delete_attachment_confirm_editor',
              '确定要物理删除此图片附件并清除引用标记吗？此操作不可逆。'
            )
          )
          if (!confirmed) return

          try {
            const res = await (window as any).api?.diary?.deleteAttachment(normalizedPath)
            if (res?.success) {
              view.dispatch({
                changes: { from, to, insert: '' }
              })
              toast.showSuccess(
                t(
                  'markdown.delete_attachment_success_editor',
                  '图片附件及引用已清除'
                )
              )
            } else {
              toast.showError(res?.error || t('markdown.delete_attachment_failed', '删除失败'))
            }
          } catch (err: any) {
            toast.showError(err.message)
          }
        }
      })
      return () => {
        setImageActionCallback(null)
      }
    }, [toast, dialog, t])

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
        cmPlaceholder(placeholder || ''),
        livePreviewPlugin(resolveUrl),
        livePreviewSyntaxHighlighting(),
        attachmentUrlPlugin(resolveUrl),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.domEventHandlers({
          click: (event, view) => {
            const target = event.target as HTMLElement
            // 如果点击的是图片容器内的元素，不处理预览
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
            // 如果点击的是图片容器内的元素，由图片自己的 contextmenu 逻辑处理，这里退避
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
        doc: content,
        extensions
      })

      const view = new EditorView({ state, parent: container })
      viewRef.current = view

      // 将光标定位在最末尾，并自动聚焦
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
      if (content !== view.state.doc.toString()) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: content
          }
        })
      }
    }, [content])

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }, [])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const dropHandler = onDropFilesRef.current || onPasteFilesRef.current
      if (!dropHandler) return

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      try {
        const markdowns = await dropHandler(files)
        const view = viewRef.current
        if (!view) return
        const insertText = markdowns.join('\n\n') + '\n\n'
        const { from } = view.state.selection.main
        view.dispatch({
          changes: { from, insert: insertText },
          selection: { anchor: from + insertText.length }
        })
        view.focus()
      } catch (err) {
        console.error('Failed to handle dropped files:', err)
      }
    }, [])

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
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
        const view = viewRef.current
        if (!view) return

        const markdowns = await pasteHandler(files)
        const insertText = markdowns.join('\n\n') + '\n\n'

        const { from } = view.state.selection.main
        view.dispatch({
          changes: { from, insert: insertText },
          selection: { anchor: from + insertText.length }
        })
        view.focus()
      } catch (err) {
        console.error('Failed to paste files:', err)
      }
    }, [])

    return (
      <div
        className="codemirror-editor-wrapper"
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <div ref={containerRef} style={{ height: '100%' }} />
        {previewSrc && (
          <ImagePreview
            src={previewSrc}
            isOpen={!!previewSrc}
            onClose={() => setPreviewSrc(null)}
          />
        )}
        {textContextMenu && createPortal(
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                background: 'transparent'
              }}
              onMouseDown={() => setTextContextMenu(null)}
            />
            <div
              ref={cmMenuRef}
              className="cm-context-menu"
              style={{
                position: 'fixed',
                zIndex: 10000,
                left: textContextMenu.x,
                top: textContextMenu.y
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                className="cm-context-menu-item"
                disabled={!textContextMenu.hasSelection}
                onClick={() => {
                  document.execCommand('copy')
                  setTextContextMenu(null)
                }}
              >
                {t('common.copy', '复制')}
              </button>
              <button
                className="cm-context-menu-item"
                disabled={!textContextMenu.hasSelection}
                onClick={() => {
                  document.execCommand('cut')
                  setTextContextMenu(null)
                }}
              >
                {t('common.cut', '剪切')}
              </button>
              <button
                className="cm-context-menu-item"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText()
                    const view = viewRef.current
                    if (view) {
                      const { from, to } = view.state.selection.main
                      view.dispatch({
                        changes: { from, to, insert: text },
                        selection: { anchor: from + text.length }
                      })
                      view.focus()
                    }
                  } catch (err) {
                    console.error(err)
                  }
                  setTextContextMenu(null)
                }}
              >
                {t('common.paste', '粘贴')}
              </button>
              <div className="cm-context-menu-divider" />
              <button
                className="cm-context-menu-item"
                onClick={() => {
                  const view = viewRef.current
                  if (view) {
                    undo(view)
                    view.focus()
                  }
                  setTextContextMenu(null)
                }}
              >
                {t('common.undo', '撤销')}
              </button>
              <button
                className="cm-context-menu-item"
                onClick={() => {
                  const view = viewRef.current
                  if (view) {
                    view.dispatch({
                      selection: { anchor: 0, head: view.state.doc.length }
                    })
                    view.focus()
                  }
                  setTextContextMenu(null)
                }}
              >
                {t('common.select_all', '全选')}
              </button>
            </div>
          </>,
          document.body
        )}
      </div>
    )
  }
)
