import {
  createFileRefChipElement,
  createSkillChipElement,
  isComposerChip
} from './skill-composer-chips.util'
import { serializeSkillComposer } from './skill-composer-serialize.util'
import {
  deleteAtQueryInComposer,
  deleteSlashQueryInComposer,
  placeCaretAfter
} from './skill-composer-tokens.util'
import type { FileRefChip, MentionToken, SkillRefChip, SlashToken } from './skill-composer.types'

export function insertSkillChipAtSelection(
  root: HTMLElement,
  chip: SkillRefChip,
  chipClassName: string,
  textClassName: string,
  slashToken: SlashToken | null
): void {
  root.focus()
  const sel = window.getSelection()
  if (!sel) return

  let insertRange: Range | null = null

  if (slashToken) {
    const startOk =
      slashToken.range.startContainer.isConnected && root.contains(slashToken.range.startContainer)
    if (startOk) {
      insertRange = slashToken.range.cloneRange()
      insertRange.deleteContents()
    } else {
      insertRange = deleteSlashQueryInComposer(root, slashToken.query)
    }
  }

  if (!insertRange) {
    if (sel.rangeCount && root.contains(sel.anchorNode)) {
      insertRange = sel.getRangeAt(0)
      insertRange.deleteContents()
    } else {
      insertRange = document.createRange()
      insertRange.selectNodeContents(root)
      insertRange.collapse(false)
    }
  }

  const el = createSkillChipElement(chip, chipClassName, textClassName)
  const zwsp = document.createTextNode('\u200B')
  insertRange.insertNode(zwsp)
  insertRange.insertNode(el)
  placeCaretAfter(zwsp)
}

export function insertFileRefChipAtSelection(
  root: HTMLElement,
  chip: FileRefChip,
  chipClassName: string,
  textClassName: string,
  mentionToken: MentionToken | null
): void {
  const sel = window.getSelection()
  if (!sel) return
  const selectionWasInRoot = Boolean(
    sel.rangeCount && sel.anchorNode && root.contains(sel.anchorNode)
  )
  root.focus()

  let insertRange: Range | null = null

  if (mentionToken) {
    const startOk =
      mentionToken.range.startContainer.isConnected &&
      root.contains(mentionToken.range.startContainer)
    if (startOk) {
      insertRange = mentionToken.range.cloneRange()
      insertRange.deleteContents()
    } else {
      insertRange = deleteAtQueryInComposer(root, mentionToken.query)
    }
  }

  if (!insertRange) {
    if (selectionWasInRoot && sel.rangeCount) {
      insertRange = sel.getRangeAt(0)
      insertRange.deleteContents()
    } else {
      insertRange = document.createRange()
      insertRange.selectNodeContents(root)
      insertRange.collapse(false)
    }
  }

  const el = createFileRefChipElement(chip, chipClassName, textClassName)
  const comment = chip.comment?.trim()
  const after = document.createTextNode(comment ? `\u200B ${comment} ` : '\u200B')
  insertRange.insertNode(after)
  insertRange.insertNode(el)
  placeCaretAfter(after)
}

export function clearComposer(root: HTMLElement) {
  root.innerHTML = ''
}

export function isComposerVisuallyEmpty(root: HTMLElement): boolean {
  const { plainText, skills, fileRefs } = serializeSkillComposer(root)
  return (
    plainText.replace(/\u200B/g, '').replace(/\s/g, '') === '' &&
    skills.length === 0 &&
    fileRefs.length === 0
  )
}

/** 若编辑器已无有效内容，清空残留 <br>/zwsp，避免多行误判 */
export function normalizeEmptyComposer(root: HTMLElement): boolean {
  if (!isComposerVisuallyEmpty(root)) return false
  clearComposer(root)
  return true
}

/** Backspace：若光标紧贴芯片右侧，则删除该芯片 */
export function tryDeleteSkillChipByBackspace(root: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false
  if (!root.contains(sel.anchorNode)) return false

  const node = sel.anchorNode
  const offset = sel.anchorOffset

  let chip: HTMLElement | null = null

  if (node === root && offset > 0) {
    const prev = root.childNodes[offset - 1]
    if (isComposerChip(prev)) chip = prev as HTMLElement
  } else if (node?.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    if (
      offset === 0 ||
      (offset === 1 && text === '\u200B') ||
      (offset > 0 && text.slice(0, offset).replace(/\u200B/g, '') === '')
    ) {
      const prev = node.previousSibling
      if (isComposerChip(prev)) chip = prev as HTMLElement
    }
  } else if (node && node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement
    if (offset === 0) {
      const prev = el.previousSibling
      if (isComposerChip(prev)) chip = prev as HTMLElement
    } else {
      const prev = el.childNodes[offset - 1]
      if (isComposerChip(prev)) chip = prev as HTMLElement
    }
  }

  if (!chip) return false
  const next = chip.nextSibling
  chip.remove()
  if (
    next?.nodeType === Node.TEXT_NODE &&
    (next.textContent === '\u200B' || next.textContent === '')
  ) {
    next.remove()
  }
  if (normalizeEmptyComposer(root)) {
    root.focus()
    return true
  }
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}
