import { describe, it, expect } from 'vitest'
import {
  splitMarkdownIntoBlocks,
  splitStreamingMarkdownBlocks,
  hasUnclosedCodeFence
} from '../fluid-markdown-blocks'

describe('splitMarkdownIntoBlocks', () => {
  it('splits paragraphs on blank lines', () => {
    const blocks = splitMarkdownIntoBlocks('first paragraph\n\nsecond paragraph')
    expect(blocks).toEqual(['first paragraph', 'second paragraph'])
  })

  it('treats headings as separate blocks', () => {
    const blocks = splitMarkdownIntoBlocks('intro\n\n## Title\n\nbody')
    expect(blocks).toEqual(['intro', '## Title', 'body'])
  })

  it('groups consecutive list items', () => {
    const blocks = splitMarkdownIntoBlocks('- one\n- two\n\nafter list')
    expect(blocks).toEqual(['- one\n- two', 'after list'])
  })

  it('groups blockquote lines', () => {
    const blocks = splitMarkdownIntoBlocks('> quote one\n> quote two\n\nplain')
    expect(blocks).toEqual(['> quote one\n> quote two', 'plain'])
  })

  it('keeps fenced code as one block', () => {
    const blocks = splitMarkdownIntoBlocks('before\n\n```js\nconst x = 1\n```\n\nafter')
    expect(blocks).toEqual(['before', '```js\nconst x = 1\n```', 'after'])
  })
})

describe('hasUnclosedCodeFence', () => {
  it('detects unclosed fences', () => {
    expect(hasUnclosedCodeFence('```ts\nconst a = 1')).toBe(true)
    expect(hasUnclosedCodeFence('```ts\nconst a = 1\n```')).toBe(false)
  })
})

describe('splitStreamingMarkdownBlocks', () => {
  it('puts all but last block into stable markdown', () => {
    const split = splitStreamingMarkdownBlocks('done paragraph\n\nstill typing')
    expect(split.degradeToPlainText).toBe(false)
    expect(split.stableMarkdown).toBe('done paragraph')
    expect(split.activeBlock).toBe('still typing')
    expect(split.stableBlockCount).toBe(1)
  })

  it('keeps single block active only', () => {
    const split = splitStreamingMarkdownBlocks('only one block streaming')
    expect(split.stableMarkdown).toBe('')
    expect(split.activeBlock).toBe('only one block streaming')
    expect(split.stableBlockCount).toBe(0)
  })

  it('does not markdown-render unclosed code fence in stable part', () => {
    const content = 'intro\n\n```js\nconst x = 1'
    const split = splitStreamingMarkdownBlocks(content)
    expect(split.stableMarkdown).toBe('intro')
    expect(split.activeBlock).toBe('```js\nconst x = 1')
    expect(split.stableBlockCount).toBe(1)
  })

  it('degrades short content to plain text mode', () => {
    const split = splitStreamingMarkdownBlocks('short text')
    expect(split.degradeToPlainText).toBe(true)
    expect(split.activeBlock).toBe('short text')
    expect(split.stableMarkdown).toBe('')
  })

  it('degrades markdown tables to plain text mode', () => {
    const content = '| a | b |\n|---|---|\n| 1 | 2 |'
    const split = splitStreamingMarkdownBlocks(content)
    expect(split.degradeToPlainText).toBe(true)
    expect(split.activeBlock).toBe(content)
  })
})
