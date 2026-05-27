import { useEffect, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import type { TFunction } from 'i18next'
import { setImageActionCallback, setUpdateImageWidthCallback } from './codeMirrorDecorations'
import { parseImageMarkdown, buildImageMarkdown } from './image-utils'
import type { useDialog } from '../Dialog'
import type { useToast } from '../Toast/useToast'

type DialogApi = ReturnType<typeof useDialog>
type ToastApi = ReturnType<typeof useToast>

export function useCodeMirrorImageCallbacks(
  viewRef: RefObject<EditorView | null>,
  toast: ToastApi,
  dialog: DialogApi,
  t: TFunction
) {
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
  }, [viewRef])

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
              t('markdown.delete_attachment_success_editor', '图片附件及引用已清除')
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
  }, [viewRef, toast, dialog, t])
}
