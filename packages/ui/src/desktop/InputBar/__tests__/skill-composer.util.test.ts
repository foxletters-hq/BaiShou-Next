import { describe, expect, it } from 'vitest'
import {
  createSkillChipElement,
  deleteSlashQueryInComposer,
  getSlashTokenBeforeCaret,
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
})
