import { describe, it, expect, afterEach, vi } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { replaceEditorDocumentContent } from '../editorContentSync'

describe('open diary selection safety', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  async function openDiary(content: string) {
    parent = document.createElement('div')
    parent.style.width = '720px'
    parent.style.height = '560px'
    document.body.appendChild(parent)

    const changes: string[] = []
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode: 'mouse',
        tagLineMode: true
      },
      onChange: (next) => changes.push(next)
    })

    expect(() => view.focus()).not.toThrow()

    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => requestAnimationFrame(r))
    await new Promise((r) => requestAnimationFrame(r))
    await new Promise((r) => setTimeout(r, 80))

    const { anchor, head } = view.state.selection.main
    const len = view.state.doc.length
    expect(anchor).toBeLessThanOrEqual(len)
    expect(head).toBeLessThanOrEqual(len)

    return { view, changes }
  }

  it('plain diary open does not leave selection outside document', async () => {
    const { view } = await openDiary('#旅行\n\n今天天气不错，写点日记。')
    view.destroy()
  })

  it('diary ending with table does not leave selection outside document', async () => {
    const { view } = await openDiary('#记录\n\n| A | B |\n| --- | --- |\n| 1 | 2 |')
    view.destroy()
  })

  it('diary with only table does not leave selection outside document', async () => {
    const { view } = await openDiary('| A | B |\n| --- | --- |\n| 1 | 2 |')
    view.destroy()
  })

  it('replacing content after mount clamps selection like mobile setContent', async () => {
    const { view } = await openDiary('hello world with enough text to put cursor at end')
    view.dispatch({ selection: { anchor: view.state.doc.length, head: view.state.doc.length } })

    expect(() => replaceEditorDocumentContent(view, '#标签\n\n短正文')).not.toThrow()
    expect(view.state.selection.main.head).toBeLessThanOrEqual(view.state.doc.length)

    view.destroy()
  })

  it('simulates parent echo after ckant prettify without throwing', async () => {
    const original = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n尾部'
    const { view, changes } = await openDiary(original)

    if (changes.length > 0) {
      expect(() => replaceEditorDocumentContent(view, changes[changes.length - 1]!)).not.toThrow()
    }

    view.destroy()
  })
})
