import { isComposerChip } from './skill-composer-chips.util'
import type { MentionToken, SlashToken } from './skill-composer.types'

export function isComposerTokenBoundaryBefore(node: Text, start: number): boolean {
  if (start > 0) {
    const ch = (node.textContent ?? '')[start - 1]
    return !ch || /\s/.test(ch)
  }
  let prev: Node | null = node.previousSibling
  while (prev) {
    if (isComposerChip(prev)) return true
    if (prev.nodeType === Node.TEXT_NODE) {
      const t = (prev.textContent ?? '').replace(/\u200B/g, '')
      if (!t) {
        prev = prev.previousSibling
        continue
      }
      return /\s$/.test(t)
    }
    if (prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).tagName === 'BR') return true
    return false
  }
  return true
}

/** 从光标向前找当前 `/query` token（须在行首、空白或 chip 后） */
export function getSlashTokenBeforeCaret(root: HTMLElement): SlashToken | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null
  if (!root.contains(sel.anchorNode)) return null

  const endRange = sel.getRangeAt(0)
  const caretNode = endRange.endContainer
  const caretOffset = endRange.endOffset
  if (caretNode.nodeType !== Node.TEXT_NODE) return null
  const caretText = caretNode as Text

  const text = caretText.textContent ?? ''
  const localMatch = text.slice(0, caretOffset).match(/\/[^\s/]*$/)
  if (!localMatch) return null
  const start = caretOffset - localMatch[0].length
  if (!isComposerTokenBoundaryBefore(caretText, start)) return null

  const range = document.createRange()
  range.setStart(caretText, start)
  range.setEnd(caretText, caretOffset)
  return { query: localMatch[0].slice(1), range }
}

/** 从光标向前找当前 `@query` token（须在行首、空白或 chip 后） */
export function getAtTokenBeforeCaret(root: HTMLElement): MentionToken | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null
  if (!root.contains(sel.anchorNode)) return null

  const endRange = sel.getRangeAt(0)
  const caretNode = endRange.endContainer
  const caretOffset = endRange.endOffset
  if (caretNode.nodeType !== Node.TEXT_NODE) return null
  const caretText = caretNode as Text

  const text = caretText.textContent ?? ''
  const localMatch = text.slice(0, caretOffset).match(/@[^\s]*$/)
  if (!localMatch) return null
  const start = caretOffset - localMatch[0].length
  if (!isComposerTokenBoundaryBefore(caretText, start)) return null

  const range = document.createRange()
  range.setStart(caretText, start)
  range.setEnd(caretText, caretOffset)
  return { query: localMatch[0].slice(1), range }
}

function deleteTokenQueryInComposer(root: HTMLElement, needle: string): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let last: { node: Text; start: number; end: number } | null = null
  let node: Node | null
  while ((node = walker.nextNode())) {
    const textNode = node as Text
    const text = textNode.textContent ?? ''
    let from = 0
    while (from <= text.length) {
      const found = text.indexOf(needle, from)
      if (found < 0) break
      const end = found + needle.length
      const after = text[end]
      if (isComposerTokenBoundaryBefore(textNode, found) && (after == null || /\s/.test(after))) {
        last = { node: textNode, start: found, end }
      }
      from = found + 1
    }
  }
  if (!last) return null
  const range = document.createRange()
  range.setStart(last.node, last.start)
  range.setEnd(last.node, last.end)
  range.deleteContents()
  return range
}

/** 在编辑器中定位并删除 `/query`（菜单点击导致选区丢失时的回退） */
export function deleteSlashQueryInComposer(root: HTMLElement, query: string): Range | null {
  return deleteTokenQueryInComposer(root, `/${query}`)
}

export function deleteAtQueryInComposer(root: HTMLElement, query: string): Range | null {
  return deleteTokenQueryInComposer(root, `@${query}`)
}

export function placeCaretAfter(node: Node) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}
