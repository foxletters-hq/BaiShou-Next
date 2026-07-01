import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'

describe('TableBlockWidget touch handles', () => {
  let parent: HTMLElement | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    parent?.remove()
    parent = null
    document.querySelectorAll('.cm-table-context-menu-layer').forEach((el) => el.remove())
  })

  it('opens column menu after long press on touch handle', () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const handle = parent.querySelector('.cm-table-col-handle') as HTMLButtonElement | null
    expect(handle).toBeTruthy()

    handle!.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(10, 10)] }))
    vi.advanceTimersByTime(420)
    handle!.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(10, 10)] }))
    expect(document.querySelector('.cm-table-context-menu')).toBeTruthy()
    expect(document.querySelector('.cm-table-context-menu')?.textContent).toContain('删除列')

    view.destroy()
  })

  it('does not open menu when finger moves beyond threshold', () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const handle = parent.querySelector('.cm-table-col-handle') as HTMLButtonElement | null
    handle!.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(10, 10)] }))
    handle!.dispatchEvent(
      new TouchEvent('touchmove', { touches: [touch(40, 10)] })
    )
    vi.advanceTimersByTime(420)
    handle!.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(40, 10)] }))
    expect(document.querySelector('.cm-table-context-menu')).toBeFalsy()

    view.destroy()
  })

  it('keeps menu open when tapping menu padding without passing through', () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const handle = parent.querySelector('.cm-table-col-handle') as HTMLButtonElement | null
    handle!.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(10, 10)] }))
    vi.advanceTimersByTime(420)
    handle!.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(10, 10)] }))

    const menu = document.querySelector('.cm-table-context-menu') as HTMLElement | null
    expect(menu).toBeTruthy()
    menu!.dispatchEvent(
      new TouchEvent('touchstart', { bubbles: true, touches: [touch(12, 12)] })
    )
    expect(document.querySelector('.cm-table-context-menu-layer')).toBeTruthy()

    const backdrop = document.querySelector(
      '.cm-table-context-menu-backdrop'
    ) as HTMLElement | null
    vi.advanceTimersByTime(400)
    backdrop!.dispatchEvent(
      new TouchEvent('touchend', { bubbles: true, changedTouches: [touch(1, 1)] })
    )
    expect(document.querySelector('.cm-table-context-menu-layer')).toBeFalsy()

    view.destroy()
  })

  it('renders outer grid shell border wrapper', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    expect(parent.querySelector('.cm-table-grid-shell')).toBeTruthy()

    view.destroy()
  })
})

function touch(clientX: number, clientY: number): Touch {
  return {
    clientX,
    clientY,
    identifier: 0,
    pageX: clientX,
    pageY: clientY,
    screenX: clientX,
    screenY: clientY,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
    target: document.body
  } as Touch
}
