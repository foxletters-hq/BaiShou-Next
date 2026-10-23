import { formatFileMentionLabel } from '@baishou/shared'
import {
  isFileRefChip,
  isSkillChip,
  makeSkillChipId,
  readFileRefChip
} from './skill-composer-chips.util'
import {
  SKILL_CHIP_ATTR,
  SKILL_COMMAND_ATTR,
  SKILL_CONTENT_ATTR,
  type FileRefChip,
  type SkillRefChip
} from './skill-composer.types'

export function serializeSkillComposer(root: HTMLElement): {
  plainText: string
  skills: SkillRefChip[]
  fileRefs: FileRefChip[]
  sendText: string
} {
  const skills: SkillRefChip[] = []
  const fileRefs: FileRefChip[] = []
  const plainParts: string[] = []
  const sendParts: string[] = []

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? ''
      plainParts.push(value)
      sendParts.push(value)
      return
    }
    if (isSkillChip(node)) {
      const chipEl = node as HTMLElement
      const id = chipEl.getAttribute(SKILL_CHIP_ATTR) || makeSkillChipId('skill')
      const command = chipEl.getAttribute(SKILL_COMMAND_ATTR) || 'skill'
      const content = chipEl.getAttribute(SKILL_CONTENT_ATTR) || ''
      skills.push({ id, command, content })
      plainParts.push(`/${command}`)
      if (content.trim()) sendParts.push(content.trim())
      return
    }
    if (isFileRefChip(node)) {
      const chip = readFileRefChip(node as HTMLElement)
      fileRefs.push(chip)
      const label = formatFileMentionLabel(chip)
      plainParts.push(label)
      return
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.tagName === 'BR') {
        plainParts.push('\n')
        sendParts.push('\n')
        return
      }
      const block = el.tagName === 'DIV' || el.tagName === 'P'
      if (block && (plainParts.length > 0 || sendParts.length > 0)) {
        const lastPlain = plainParts[plainParts.length - 1] ?? ''
        const lastSend = sendParts[sendParts.length - 1] ?? ''
        if (!lastPlain.endsWith('\n')) plainParts.push('\n')
        if (!lastSend.endsWith('\n')) sendParts.push('\n')
      }
      for (const child of Array.from(el.childNodes)) walk(child)
    }
  }

  for (const child of Array.from(root.childNodes)) walk(child)

  let plainText = plainParts.join('').replace(/\u200B/g, '')
  let sendText = sendParts
    .join('')
    .replace(/\u200B/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // contenteditable 清空后常残留 <br>，不要当成真实换行，否则会误判多行布局
  if (skills.length === 0 && fileRefs.length === 0 && plainText.replace(/\s/g, '') === '') {
    plainText = ''
    sendText = ''
  }

  return { plainText, skills, fileRefs, sendText }
}
