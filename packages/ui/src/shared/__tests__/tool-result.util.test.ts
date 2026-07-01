import { describe, expect, it } from 'vitest'
import {
  getToolDisplayName,
  normalizeToolResultPlainText,
  resolveActiveToolDisplayName,
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

describe('getToolDisplayName', () => {
  const t = (key: string, fallback?: string) => (key === 'agent.tools.diary_search' ? '日记搜索' : fallback ?? key)

  it('reads legacy name field when toolName is missing', () => {
    expect(
      getToolDisplayName(
        { toolCallId: 'call-1', name: 'diary_search' } as { toolCallId: string; toolName?: string },
        t
      )
    ).toBe('日记搜索')
  })
})

describe('resolveActiveToolDisplayName', () => {
  const t = (key: string, fallback?: string) => {
    if (key === 'agent.tools.web_search') return '网络搜索'
    if (key === 'settings.web_search_engine_exa_mcp') return 'Exa MCP'
    return fallback ?? key
  }

  it('includes search engine label for web_search', () => {
    expect(resolveActiveToolDisplayName({ name: 'web_search' }, t, 'exa-mcp')).toBe(
      '网络搜索 (Exa MCP)'
    )
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
