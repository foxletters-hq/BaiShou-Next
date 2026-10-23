import type { InputBarRef } from './input-bar.types'
import {
  createSkillChipElement,
  makeSkillChipId,
  setComposerPlainText,
  type FileRefChip,
  type SkillRefChip
} from './skill-composer.util'
import { appendPlainWithBreaks, syncEditorState } from './input-bar-composer-sync.util'
import styles from './InputBar.module.css'

export function createInputBarHandle(params: {
  editorRef: React.RefObject<HTMLDivElement | null>
  applyExternalText: (value: string | ((prev: string) => string)) => void
  setText: (v: string) => void
  setSkillRefs: (v: SkillRefChip[]) => void
  setFileRefs: (v: FileRefChip[]) => void
  setSendTextCache: (v: string) => void
  htmlSnapshotRef: React.MutableRefObject<string>
  textRef: React.MutableRefObject<string>
  skillRefsRef: React.MutableRefObject<SkillRefChip[]>
  setComposerSyncHtml: (value: string) => void
  setComposerSyncKey: (updater: (k: number) => number) => void
  setSlashToken: (value: null) => void
  setSkillPickerOpen: (open: boolean) => void
  addSkillRef: (command: string, content: string) => void
  addFileContext: InputBarRef['addFileContext']
  handleAttachmentDrop: (dataTransfer: DataTransfer) => void | Promise<void>
}): InputBarRef {
  return {
    insertText: (newText) => {
      const root = params.editorRef.current
      if (!root) {
        params.applyExternalText((prev) => (prev ? `${prev}\n${newText}` : newText))
        return
      }
      root.focus()
      const sel = window.getSelection()
      if (sel && sel.rangeCount && root.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(newText))
        range.collapse(false)
      } else {
        setComposerPlainText(root, root.textContent ? `${root.textContent}\n${newText}` : newText)
      }
      syncEditorState(root, {
        setText: params.setText,
        setSkillRefs: params.setSkillRefs,
        setFileRefs: params.setFileRefs,
        setSendTextCache: params.setSendTextCache,
        htmlSnapshotRef: params.htmlSnapshotRef
      })
    },
    setText: (nextText) => {
      params.applyExternalText(nextText)
      queueMicrotask(() => params.editorRef.current?.focus())
    },
    getDraft: () => ({
      text: params.textRef.current,
      skillRefs: params.skillRefsRef.current.map((skill) => ({
        command: skill.command,
        content: skill.content
      }))
    }),
    restoreDraft: (draft) => {
      const plain = typeof draft.text === 'string' ? draft.text : ''
      const refs = (draft.skillRefs ?? [])
        .map((skill) => ({
          command: String(skill.command ?? '')
            .trim()
            .replace(/^\//, ''),
          content: typeof skill.content === 'string' ? skill.content : ''
        }))
        .filter((skill) => Boolean(skill.command))

      if (refs.length === 0) {
        params.applyExternalText(plain)
        queueMicrotask(() => params.editorRef.current?.focus())
        return
      }

      const container = document.createElement('div')
      let remaining = plain
      for (const skill of refs) {
        const label = `/${skill.command}`
        const idx = remaining.indexOf(label)
        if (idx < 0) continue
        if (idx > 0) {
          appendPlainWithBreaks(container, remaining.slice(0, idx))
        }
        container.appendChild(
          createSkillChipElement(
            {
              id: makeSkillChipId(skill.command),
              command: skill.command,
              content: skill.content
            },
            styles.skillRefChip,
            styles.skillRefText
          )
        )
        remaining = remaining.slice(idx + label.length)
      }
      if (remaining) appendPlainWithBreaks(container, remaining)

      params.setComposerSyncHtml(container.innerHTML)
      params.setComposerSyncKey((k) => k + 1)
      params.setSlashToken(null)
      params.setSkillPickerOpen(false)
      queueMicrotask(() => params.editorRef.current?.focus())
    },
    insertShortcutContent: (content) => {
      params.addSkillRef(`skill-${Date.now().toString(36)}`, content)
    },
    applySkillRef: (skill) => {
      const command =
        skill.command?.trim() ||
        skill.name?.trim() ||
        skill.id?.trim() ||
        `skill-${Date.now().toString(36)}`
      params.addSkillRef(command, skill.content || '')
    },
    addFileContext: params.addFileContext,
    ingestDrop: async (dataTransfer) => {
      await params.handleAttachmentDrop(dataTransfer)
    },
    focus: () => params.editorRef.current?.focus()
  }
}
