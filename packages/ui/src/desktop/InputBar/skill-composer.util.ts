import { parseFileMentionToken } from '@baishou/shared'
import { isComposerChip } from './skill-composer-chips.util'
import { FILE_REF_CHIP_ATTR, SKILL_CHIP_ATTR } from './skill-composer.types'

export type { FileRefChip, MentionToken, SkillRefChip, SlashToken } from './skill-composer.types'
export {
  FILE_REF_CHIP_ATTR,
  FILE_REF_COMMENT_ATTR,
  FILE_REF_DIRECTORY_ATTR,
  FILE_REF_ORIGIN_ATTR,
  FILE_REF_PATH_ATTR,
  FILE_REF_SELECTION_ATTR,
  SKILL_CHIP_ATTR,
  SKILL_COMMAND_ATTR,
  SKILL_CONTENT_ATTR
} from './skill-composer.types'
export {
  createFileRefChipElement,
  createSkillChipElement,
  makeFileRefChipId,
  makeSkillChipId,
  readFileRefChip
} from './skill-composer-chips.util'
export { serializeSkillComposer } from './skill-composer-serialize.util'
export {
  deleteAtQueryInComposer,
  deleteSlashQueryInComposer,
  getAtTokenBeforeCaret,
  getSlashTokenBeforeCaret,
  placeCaretAfter
} from './skill-composer-tokens.util'
export {
  clearComposer,
  insertFileRefChipAtSelection,
  insertSkillChipAtSelection,
  isComposerVisuallyEmpty,
  normalizeEmptyComposer,
  tryDeleteSkillChipByBackspace
} from './skill-composer-mutate.util'

export function setComposerPlainText(root: HTMLElement, text: string) {
  root.textContent = text
}

/**
 * 清掉 contenteditable 里非引用芯片节点的内联样式/语义标签，
 * 避免粘贴或 IME 残留带来底色、色字。
 */
export function sanitizeComposerFormatting(root: HTMLElement): boolean {
  let changed = false
  const victims: HTMLElement[] = []
  const elements = Array.from(root.querySelectorAll<HTMLElement>('*'))
  for (const el of elements) {
    if (
      isComposerChip(el) ||
      el.closest(`[${SKILL_CHIP_ATTR}]`) ||
      el.closest(`[${FILE_REF_CHIP_ATTR}]`)
    ) {
      continue
    }
    const tag = el.tagName
    if (
      tag === 'FONT' ||
      tag === 'MARK' ||
      tag === 'SPAN' ||
      tag === 'B' ||
      tag === 'I' ||
      tag === 'U' ||
      tag === 'STRONG' ||
      tag === 'EM' ||
      tag === 'A'
    ) {
      if (
        el.hasAttribute('style') ||
        el.hasAttribute('color') ||
        el.hasAttribute('bgcolor') ||
        tag !== 'SPAN'
      ) {
        victims.push(el)
      } else if (tag === 'SPAN' && el.attributes.length === 0) {
        victims.push(el)
      }
    } else if (el.hasAttribute('style')) {
      el.removeAttribute('style')
      changed = true
    }
  }
  for (const el of victims) {
    if (!el?.isConnected) continue
    const parent = el.parentNode
    if (!parent) continue
    let child = el.firstChild
    while (child) {
      const next = child.nextSibling
      parent.insertBefore(child, el)
      child = next
    }
    parent.removeChild(el)
    changed = true
  }
  return changed
}

export { parseFileMentionToken }
