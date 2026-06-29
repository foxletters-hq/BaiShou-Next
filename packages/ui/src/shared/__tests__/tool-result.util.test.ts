import { describe, expect, it } from 'vitest'
import {
  normalizeToolResultPlainText,
  resolveToolResultPresentation,
  unwrapPlainToolResultText
} from '../tool-result.util'

describe('normalizeToolResultPlainText', () => {
  it('removes empty lines and collapses excessive blank space', () => {
    const input = 'Title\n\n\n\n\nBody line\n   \n\nAnother'
    expect(normalizeToolResultPlainText(input)).toBe('Title\nBody line\nAnother')
  })
})

describe('unwrapPlainToolResultText', () => {
  it('unwraps vercel text output objects', () => {
    expect(unwrapPlainToolResultText({ type: 'text', value: 'hello' })).toBe('hello')
  })
})

describe('resolveToolResultPresentation', () => {
  it('renders url_read as markdown plain text with source url', () => {
    const presentation = resolveToolResultPresentation({
      toolName: 'url_read',
      args: { url: 'https://example.com' },
      result: '# Heading\n\n\n\nParagraph'
    })

    expect(presentation.mode).toBe('plain')
    if (presentation.mode !== 'plain') return
    expect(presentation.renderAsMarkdown).toBe(true)
    expect(presentation.sourceUrl).toBe('https://example.com')
    expect(presentation.text).toBe('# Heading\nParagraph')
  })

  it('keeps structured search arrays', () => {
    const presentation = resolveToolResultPresentation({
      toolName: 'web_search',
      result: [{ title: 'A', url: 'https://a.test', snippet: 'snippet' }]
    })

    expect(presentation.mode).toBe('structured')
  })
})
