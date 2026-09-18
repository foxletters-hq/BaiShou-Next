import type { PromptFileRef } from '@baishou/shared'
import { serializeSkillComposer, type FileRefChip, type SkillRefChip } from './skill-composer.util'

export function appendPlainWithBreaks(container: HTMLElement, text: string) {
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    if (line) container.appendChild(document.createTextNode(line))
    if (index < lines.length - 1) container.appendChild(document.createElement('br'))
  })
}

export function syncEditorState(
  root: HTMLElement,
  setters: {
    setText: (v: string) => void
    setSkillRefs: (v: SkillRefChip[]) => void
    setFileRefs: (v: FileRefChip[]) => void
    setSendTextCache: (v: string) => void
    htmlSnapshotRef: React.MutableRefObject<string>
  }
) {
  const snap = serializeSkillComposer(root)
  setters.setText(snap.plainText)
  setters.setSkillRefs(snap.skills)
  setters.setFileRefs(snap.fileRefs)
  setters.setSendTextCache(snap.sendText)
  setters.htmlSnapshotRef.current = root.innerHTML
  return snap
}

export function toSendFileRefs(refs: FileRefChip[]): PromptFileRef[] {
  return refs
    .map((ref) => ({
      relativePath: ref.relativePath,
      selection: ref.selection,
      comment: ref.comment,
      origin: ref.origin ?? 'mention',
      ...(ref.isDirectory ? { isDirectory: true } : {})
    }))
    .filter((ref) => Boolean(ref.relativePath))
}
