import { describe, expect, it } from 'vitest'
import {
  createFileRefChipElement,
  createSkillChipElement,
  deleteSlashQueryInComposer,
  getAtTokenBeforeCaret,
  getSlashTokenBeforeCaret,
  insertFileRefChipAtSelection,
  makeSkillChipId,
  serializeSkillComposer,
  tryDeleteSkillChipByBackspace
} from '../skill-composer.util'

function mountEditor(html = ''): HTMLDivElement {
  const root = document.createElement('div')
  root.contentEditable = 'true'
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

function placeCaret(node: Node, offset: number) {
  const sel = window.getSelection()!
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

describe('skill-composer.util', () => {
  it('serializes text and skill chips for send', () => {
    const root = mountEditor()
    root.appendChild(document.createTextNode('hello '))
    root.appendChild(
      createSkillChipElement(
        { id: '1', command: 'translate', content: '请翻译：' },
        'chip',
        'chipText'
      )
    )
    root.appendChild(document.createTextNode(' world'))
    const snap = serializeSkillComposer(root)
    expect(snap.plainText).toBe('hello /translate world')
    expect(snap.skills).toHaveLength(1)
    expect(snap.sendText).toContain('请翻译：')
    expect(snap.sendText).toContain('hello')
    root.remove()
  })

  it('detects slash token after whitespace', () => {
    const root = mountEditor()
    const text = document.createTextNode('hi /tr')
    root.appendChild(text)
    placeCaret(text, text.textContent!.length)
    const token = getSlashTokenBeforeCaret(root)
    expect(token?.query).toBe('tr')
    root.remove()
  })

  it('does not treat mid-word slash as skill token', () => {
    const root = mountEditor()
    const text = document.createTextNode('a/b')
    root.appendChild(text)
    placeCaret(text, text.textContent!.length)
    expect(getSlashTokenBeforeCaret(root)).toBeNull()
    root.remove()
  })

  it('deletes slash query when selection is lost', () => {
    const root = mountEditor()
    const text = document.createTextNode('note /sum')
    root.appendChild(text)
    expect(deleteSlashQueryInComposer(root, 'sum')).not.toBeNull()
    expect(root.textContent).toBe('note ')
    root.remove()
  })

  it('removes adjacent skill chip on backspace', () => {
    const root = mountEditor()
    const chip = createSkillChipElement(
      { id: makeSkillChipId('x'), command: 'x', content: 'body' },
      'chip',
      'chipText'
    )
    const zwsp = document.createTextNode('\u200B')
    root.appendChild(chip)
    root.appendChild(zwsp)
    placeCaret(zwsp, 1)
    expect(tryDeleteSkillChipByBackspace(root)).toBe(true)
    expect(root.querySelector('[data-skill-ref]')).toBeNull()
    expect(root.innerHTML).toBe('')
    root.remove()
  })

  it('treats lone br as empty plain text', () => {
    const root = mountEditor('<br>')
    const snap = serializeSkillComposer(root)
    expect(snap.plainText).toBe('')
    expect(snap.skills).toHaveLength(0)
    root.remove()
  })

  it('detects at-mention token after whitespace', () => {
    const root = mountEditor()
    const text = document.createTextNode('see @src/ap')
    root.appendChild(text)
    placeCaret(text, text.textContent!.length)
    expect(getAtTokenBeforeCaret(root)?.query).toBe('src/ap')
    root.remove()
  })

  it('does not treat email-like at as mention token', () => {
    const root = mountEditor()
    const text = document.createTextNode('user@host')
    root.appendChild(text)
    placeCaret(text, text.textContent!.length)
    expect(getAtTokenBeforeCaret(root)).toBeNull()
    root.remove()
  })

  it('serializes skill and file chips together', () => {
    const root = mountEditor()
    root.appendChild(
      createSkillChipElement(
        { id: '1', command: 'translate', content: '请翻译：' },
        'chip',
        'chipText'
      )
    )
    root.appendChild(document.createTextNode(' '))
    root.appendChild(
      createFileRefChipElement(
        {
          id: '2',
          relativePath: 'src/app.ts',
          selection: { startLine: 12, endLine: 20 },
          origin: 'mention'
        },
        'chip',
        'chipText'
      )
    )
    const snap = serializeSkillComposer(root)
    expect(snap.skills).toHaveLength(1)
    expect(snap.fileRefs).toEqual([
      expect.objectContaining({
        relativePath: 'src/app.ts',
        selection: { startLine: 12, endLine: 20 }
      })
    ])
    expect(snap.plainText).toContain('/translate')
    expect(snap.plainText).toContain('@app.ts#L12-20')
    expect(snap.sendText).toContain('请翻译：')
    expect(snap.sendText).not.toContain('export')
    root.remove()
  })

  it('appends a file chip and its comment at the end when the composer is not focused', () => {
    const root = mountEditor()
    root.appendChild(document.createTextNode('已有正文'))
    window.getSelection()?.removeAllRanges()
    insertFileRefChipAtSelection(
      root,
      {
        id: 'c1',
        relativePath: '月光邮局-Latte.md',
        selection: { startLine: 14, endLine: 17 },
        comment: '这里要改语气',
        origin: 'comment'
      },
      'chip',
      'chipText',
      null
    )
    const snap = serializeSkillComposer(root)
    expect(snap.plainText.startsWith('已有正文')).toBe(true)
    expect(snap.plainText).toContain('@月光邮局-Latte.md#L14-17')
    expect(snap.plainText).toContain('这里要改语气')
    expect(snap.fileRefs[0]).toEqual(
      expect.objectContaining({
        relativePath: '月光邮局-Latte.md',
        selection: { startLine: 14, endLine: 17 },
        comment: '这里要改语气'
      })
    )
    root.remove()
  })

  it('removes adjacent file chip on backspace', () => {
    const root = mountEditor()
    const chip = createFileRefChipElement(
      { id: 'f1', relativePath: 'src/app.ts', origin: 'mention' },
      'chip',
      'chipText'
    )
    const zwsp = document.createTextNode('\u200B')
    root.appendChild(chip)
    root.appendChild(zwsp)
    placeCaret(zwsp, 1)
    expect(tryDeleteSkillChipByBackspace(root)).toBe(true)
    expect(root.querySelector('[data-file-ref]')).toBeNull()
    root.remove()
  })
})
