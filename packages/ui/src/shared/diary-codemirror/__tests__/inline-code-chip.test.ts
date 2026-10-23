import { afterEach, describe, expect, it } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { editorThemeBase } from '../theme/editor-theme-base'
import { insertFencedCodeBlock, insertMarkdownLink, toggleLinePrefix } from '../extensions/keymap'
import { continueMarkdownBlockquote } from '../extensions/listContinuationKeymap'
import type { EditorView } from '@codemirror/view'

describe('inline code chip', () => {
  let parent: HTMLDivElement
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    parent?.remove()
    view = null
  })

  it('uses Obsidian-like vertical padding without negative margin', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content: 'use `code` here\n',
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode: 'mouse',
        scrollMode: 'viewport'
      }
    })

    const chip = parent.querySelector('.cm-rendered-inline-code')
    expect(chip).not.toBeNull()

    const style = getComputedStyle(chip as Element)
    expect(style.display).toBe('inline-block')
    expect(style.lineHeight).toBe('1.3')
    expect(style.boxSizing).toBe('border-box')
    expect(style.marginTop).toBe('0px')
    expect(style.marginBottom).toBe('0px')
    expect(style.fontSize).toBe('0.9em')
    expect(style.fontFamily).toContain('--font-family-mono')
    // 上 padding 略大于下 padding，让灰底在行高里视觉居中且完整包住文字与光标
    expect(parseFloat(style.paddingTop)).toBeGreaterThan(parseFloat(style.paddingBottom))
    expect(parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)).toBeCloseTo(0.22, 5)
  })

  it('keeps the zero-width ::before anchor on one line', () => {
    expect(editorThemeBase['.cm-rendered-inline-code::before'].whiteSpace).toBe('nowrap')
  })

  it('uses the same smaller mono size for fenced code lines', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content: '```\ncode block\n```\n',
      platform: {
        resolveAttachmentUrl: (url) => url,
        interactionMode: 'mouse',
        scrollMode: 'viewport'
      }
    })

    const line = parent.querySelector('.cm-code-line')
    expect(line).not.toBeNull()
    const style = getComputedStyle(line as Element)
    expect(style.fontSize).toBe('0.9em')
    expect(style.fontFamily).toContain('--font-family-mono')
    expect(style.lineHeight).toBe('1.5')

    const topLine = parent.querySelector('.cm-code-line-top')
    const bottomLine = parent.querySelector('.cm-code-line-bottom')
    expect(topLine).not.toBeNull()
    expect(bottomLine).not.toBeNull()
    expect(getComputedStyle(topLine as Element).paddingTop).toBe('4px')
    expect(getComputedStyle(bottomLine as Element).paddingBottom).toBe('4px')
  })

  it('toggles block line prefixes from the middle of a line and continues blockquotes on Enter', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content: 'hello world\n',
      platform: {
        resolveAttachmentUrl: (url) => url,
        interactionMode: 'mouse',
        scrollMode: 'viewport'
      }
    })

    // 光标在行中（'hello |world'），切换引用前缀应加在行首
    view.dispatch({ selection: { anchor: 6 } })
    toggleLinePrefix(view, '> ')
    expect(view.state.doc.line(1).text).toBe('> hello world')

    // 再次切换应移除行首 `> `
    toggleLinePrefix(view, '> ')
    expect(view.state.doc.line(1).text).toBe('hello world')

    // 引用行末尾按 Enter 自动续行 `> `，空引用行再按 Enter 退出引用
    toggleLinePrefix(view, '> ')
    const endOfLine1 = view.state.doc.line(1).to
    view.dispatch({ selection: { anchor: endOfLine1 } })
    expect(continueMarkdownBlockquote(view)).toBe(true)
    expect(view.state.doc.line(2).text).toBe('> ')
    expect(continueMarkdownBlockquote(view)).toBe(true)
    expect(view.state.doc.line(2).text).toBe('')
  })

  it('supports inserting fenced code blocks and markdown links', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content: 'selected text',
      platform: {
        resolveAttachmentUrl: (url) => url,
        interactionMode: 'mouse',
        scrollMode: 'viewport'
      }
    })

    view.dispatch({ selection: { anchor: 0, head: 13 } })
    insertMarkdownLink(view)
    expect(view.state.doc.toString()).toBe('[selected text](url)')

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: 'const x = 1' },
      selection: { anchor: 0, head: 11 }
    })
    insertFencedCodeBlock(view)
    expect(view.state.doc.toString()).toBe('```\nconst x = 1\n```')
  })
})
