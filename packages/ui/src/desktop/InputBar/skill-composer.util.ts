export type SkillRefChip = {
  id: string
  command: string
  content: string
}

export const SKILL_CHIP_ATTR = 'data-skill-ref'
export const SKILL_COMMAND_ATTR = 'data-skill-command'
export const SKILL_CONTENT_ATTR = 'data-skill-content'

export type SlashToken = {
  query: string
  range: Range
}

export function makeSkillChipId(command: string): string {
  return `${command}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function createSkillChipElement(
  chip: SkillRefChip,
  chipClassName: string,
  textClassName: string
): HTMLSpanElement {
  const el = document.createElement('span')
  el.setAttribute(SKILL_CHIP_ATTR, chip.id)
  el.setAttribute(SKILL_COMMAND_ATTR, chip.command)
  el.setAttribute(SKILL_CONTENT_ATTR, chip.content)
  el.contentEditable = 'false'
  el.className = chipClassName
  el.setAttribute('data-skill-chip', 'true')

  const label = document.createElement('span')
  label.className = textClassName
  label.textContent = `/${chip.command}`
  el.appendChild(label)
  return el
}

function isSkillChip(node: Node | null): node is HTMLElement {
  return (
    !!node &&
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).hasAttribute(SKILL_CHIP_ATTR)
  )
}

export function serializeSkillComposer(root: HTMLElement): {
  plainText: string
  skills: SkillRefChip[]
  sendText: string
} {
  const skills: SkillRefChip[] = []
  const plainParts: string[] = []
  const sendParts: string[] = []

  const walk = (node: Node, isRootChild = false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? ''
      plainParts.push(value)
      sendParts.push(value)
      return
    }
    if (isSkillChip(node)) {
      const id = node.getAttribute(SKILL_CHIP_ATTR) || makeSkillChipId('skill')
      const command = node.getAttribute(SKILL_COMMAND_ATTR) || 'skill'
      const content = node.getAttribute(SKILL_CONTENT_ATTR) || ''
      skills.push({ id, command, content })
      plainParts.push(`/${command}`)
      if (content.trim()) sendParts.push(content.trim())
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
      for (const child of Array.from(el.childNodes)) walk(child, false)
    }
  }

  for (const child of Array.from(root.childNodes)) walk(child, true)

  let plainText = plainParts.join('').replace(/\u200B/g, '')
  let sendText = sendParts
    .join('')
    .replace(/\u200B/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // contenteditable 清空后常残留 <br>，不要当成真实换行，否则会误判多行布局
  if (skills.length === 0 && plainText.replace(/\s/g, '') === '') {
    plainText = ''
    sendText = ''
  }

  return { plainText, skills, sendText }
}

function isSlashTokenBoundaryBefore(node: Text, start: number): boolean {
  if (start > 0) {
    const ch = (node.textContent ?? '')[start - 1]
    return !ch || /\s/.test(ch)
  }
  let prev: Node | null = node.previousSibling
  while (prev) {
    if (isSkillChip(prev)) return true
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

  const text = caretNode.textContent ?? ''
  const localBefore = text.slice(0, caretOffset).replace(/\u200B/g, '')
  // 用原始偏移重新匹配（忽略 zwsp 时回退到简单正则）
  const localMatch = text.slice(0, caretOffset).match(/\/[^\s/]*$/)
  if (!localMatch) return null
  const start = caretOffset - localMatch[0].length
  if (!isSlashTokenBoundaryBefore(caretNode, start)) return null

  const range = document.createRange()
  range.setStart(caretNode, start)
  range.setEnd(caretNode, caretOffset)
  return { query: localMatch[0].slice(1), range }
}

/** 在编辑器中定位并删除 `/query`（菜单点击导致选区丢失时的回退） */
export function deleteSlashQueryInComposer(root: HTMLElement, query: string): Range | null {
  const needle = `/${query}`
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
      if (isSlashTokenBoundaryBefore(textNode, found) && (after == null || /\s/.test(after))) {
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

export function placeCaretAfter(node: Node) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

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

/** Backspace：若光标紧贴 skill 芯片右侧，则删除该芯片 */
export function tryDeleteSkillChipByBackspace(root: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false
  if (!root.contains(sel.anchorNode)) return false

  const node = sel.anchorNode
  const offset = sel.anchorOffset

  let chip: HTMLElement | null = null

  if (node === root && offset > 0) {
    const prev = root.childNodes[offset - 1]
    if (isSkillChip(prev)) chip = prev
  } else if (node?.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    if (offset === 0 || (offset === 1 && text === '\u200B') || (offset > 0 && text.slice(0, offset).replace(/\u200B/g, '') === '')) {
      const prev = node.previousSibling
      if (isSkillChip(prev)) chip = prev
    }
  } else if (node && node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement
    if (offset === 0) {
      const prev = el.previousSibling
      if (isSkillChip(prev)) chip = prev
    } else {
      const prev = el.childNodes[offset - 1]
      if (isSkillChip(prev)) chip = prev
    }
  }

  if (!chip) return false
  const next = chip.nextSibling
  chip.remove()
  if (next?.nodeType === Node.TEXT_NODE && (next.textContent === '\u200B' || next.textContent === '')) {
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

export function setComposerPlainText(root: HTMLElement, text: string) {
  root.textContent = text
}

/**
 * 清掉 contenteditable 里非 Skill 芯片节点的内联样式/语义标签，
 * 避免粘贴或 IME 残留带来底色、色字。
 */
export function sanitizeComposerFormatting(root: HTMLElement): boolean {
  let changed = false
  const victims: HTMLElement[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode()) {
    const el = walker.currentNode as HTMLElement
    if (isSkillChip(el) || el.closest?.(`[${SKILL_CHIP_ATTR}]`)) continue
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
      if (el.hasAttribute('style') || el.hasAttribute('color') || el.hasAttribute('bgcolor') || tag !== 'SPAN') {
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
    if (!el.isConnected) continue
    const parent = el.parentNode
    if (!parent) continue
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
    changed = true
  }
  return changed
}


export function clearComposer(root: HTMLElement) {
  root.innerHTML = ''
}

/** 若编辑器已无有效内容，清空残留 <br>/zwsp，避免多行误判 */
export function normalizeEmptyComposer(root: HTMLElement): boolean {
  if (!isComposerVisuallyEmpty(root)) return false
  clearComposer(root)
  return true
}

export function isComposerVisuallyEmpty(root: HTMLElement): boolean {
  const { plainText, skills } = serializeSkillComposer(root)
  return plainText.replace(/\u200B/g, '').replace(/\s/g, '') === '' && skills.length === 0
}
