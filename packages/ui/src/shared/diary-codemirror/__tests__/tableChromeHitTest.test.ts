import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isInteractableChromeElement } from '../table/tableChromeHitTest'

describe('tableChromeHitTest', () => {
  let parent: HTMLElement

  beforeEach(() => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
  })

  afterEach(() => {
    parent.remove()
  })

  it('treats invisible touch chrome as non-interactable', () => {
    const btn = document.createElement('div')
    btn.className = 'cm-table-add-btn cm-table-add-row'
    btn.style.opacity = '0'
    btn.style.pointerEvents = 'none'
    btn.style.width = '24px'
    btn.style.height = '24px'
    parent.appendChild(btn)

    expect(isInteractableChromeElement(btn)).toBe(false)
  })

  it('treats visible active-cell chrome as interactable', () => {
    const block = document.createElement('div')
    block.className = 'cm-table-block cm-table-block--touch cm-table-block--has-active-cell'
    const btn = document.createElement('div')
    btn.className = 'cm-table-add-btn cm-table-add-row'
    btn.style.width = '24px'
    btn.style.height = '24px'
    block.appendChild(btn)
    parent.appendChild(block)

    expect(isInteractableChromeElement(btn)).toBe(true)
  })
})
