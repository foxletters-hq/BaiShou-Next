import { syncEditorState } from './input-bar-composer-sync.util'
import type { FileRefChip, SkillRefChip } from './skill-composer.util'

export function createInputBarKeyDownHandler(params: {
  mentionPickerOpen: boolean
  mentionPickerEntriesLength: number
  mentionDismissedRef: React.MutableRefObject<boolean>
  setMentionPickerOpen: (open: boolean) => void
  setMentionPickerIndex: (updater: (i: number) => number) => void
  submitMentionPickerSelection: () => void
  skillPickerOpen: boolean
  slashPickerEntriesLength: number
  slashDismissedRef: React.MutableRefObject<boolean>
  setSkillPickerOpen: (open: boolean) => void
  setSkillPickerIndex: (updater: (i: number) => number) => void
  submitSlashPickerSelection: () => void
  onEscape?: () => void
  editorRef: React.RefObject<HTMLDivElement | null>
  setText: (v: string) => void
  setSkillRefs: (v: SkillRefChip[]) => void
  setFileRefs: (v: FileRefChip[]) => void
  setSendTextCache: (v: string) => void
  htmlSnapshotRef: React.MutableRefObject<string>
  handleSend: () => void
}) {
  return (e: React.KeyboardEvent) => {
    if (params.mentionPickerOpen) {
      if (e.key === 'Escape') {
        e.preventDefault()
        params.mentionDismissedRef.current = true
        params.setMentionPickerOpen(false)
        return
      }
      if (params.mentionPickerEntriesLength > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          params.setMentionPickerIndex((i) =>
            Math.min(i + 1, params.mentionPickerEntriesLength - 1)
          )
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          params.setMentionPickerIndex((i) => Math.max(i - 1, 0))
          return
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
          e.preventDefault()
          params.submitMentionPickerSelection()
          return
        }
      }
    }
    if (params.skillPickerOpen && params.slashPickerEntriesLength > 0) {
      if (e.key === 'Escape') {
        e.preventDefault()
        params.slashDismissedRef.current = true
        params.setSkillPickerOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        params.setSkillPickerIndex((i) => Math.min(i + 1, params.slashPickerEntriesLength - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        params.setSkillPickerIndex((i) => Math.max(i - 1, 0))
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
        e.preventDefault()
        params.submitSlashPickerSelection()
        return
      }
    }
    if (params.skillPickerOpen && e.key === 'Escape') {
      e.preventDefault()
      params.slashDismissedRef.current = true
      params.setSkillPickerOpen(false)
      return
    }
    if (e.key === 'Escape' && params.onEscape) {
      e.preventDefault()
      params.onEscape()
      return
    }
    // IME 组字中的 Enter 交给浏览器确认候选，不发送 / 不拦截
    if (e.nativeEvent.isComposing || e.keyCode === 229) return

    if (e.key === 'Enter' && e.shiftKey) {
      // 与伙伴页一致：Shift+Enter 显式插入换行，避免 contenteditable 插入块级 div
      e.preventDefault()
      document.execCommand('insertLineBreak')
      const root = params.editorRef.current
      if (root) {
        syncEditorState(root, {
          setText: params.setText,
          setSkillRefs: params.setSkillRefs,
          setFileRefs: params.setFileRefs,
          setSendTextCache: params.setSendTextCache,
          htmlSnapshotRef: params.htmlSnapshotRef
        })
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void params.handleSend()
    }
  }
}
