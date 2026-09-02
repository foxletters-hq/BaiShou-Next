import { describe, expect, it } from 'vitest'
import {
  getToolDisplayName,
  getToolInvocationSubtitle,
  getToolRowSubtitle,
  localizeToolResultText,
  normalizeToolResultPlainText,
  resolveActiveToolDisplayName,
  resolveToolResultPresentation,
  unwrapPlainToolResultText
} from '../tool-result.util'

const passthroughT = (
  key: string,
  fallbackOrOptions?: string | { defaultValue?: string; [key: string]: unknown }
) => {
  if (typeof fallbackOrOptions === 'string') return fallbackOrOptions
  return fallbackOrOptions?.defaultValue ?? key
}

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

describe('getToolInvocationSubtitle', () => {
  it('uses the file name from path arguments', () => {
    expect(
      getToolInvocationSubtitle({
        toolName: 'workspace_write',
        args: { path: 'apps/desktop/SKILL.md', content: 'x' }
      })
    ).toBe('SKILL.md')
  })

  it('shows rename as from → to', () => {
    expect(
      getToolInvocationSubtitle({
        toolName: 'workspace_rename',
        args: { from: 'a/old.md', to: 'b/new.md' }
      })
    ).toBe('old.md → new.md')
  })

  it('uses query text for search tools', () => {
    expect(
      getToolInvocationSubtitle({
        toolName: 'web_search',
        args: { query: 'rust async' }
      })
    ).toBe('rust async')
  })

  it('parses JSON string arguments', () => {
    expect(
      getToolInvocationSubtitle({
        toolName: 'workspace_read',
        args: '{"path":"notes/draft.md"}'
      })
    ).toBe('draft.md')
  })

  it('uses skill name for skill_write instead of the long description', () => {
    expect(
      getToolInvocationSubtitle({
        toolName: 'skill_write',
        args: {
          name: 'daily-news',
          description: '当用户要求搜索并整理当天新闻、生成新闻简报时使用'
        }
      })
    ).toBe('daily-news')
  })
})

describe('getToolDisplayName', () => {
  const t = (key: string, fallback?: string) =>
    key === 'agent.tools.diary_search' ? '日记搜索' : (fallback ?? key)

  it('reads legacy name field when toolName is missing', () => {
    expect(
      getToolDisplayName(
        { toolCallId: 'call-1', name: 'diary_search' } as { toolCallId: string; toolName?: string },
        t
      )
    ).toBe('日记搜索')
  })

  it('strips mcp server prefix before looking up the display name', () => {
    expect(getToolDisplayName({ toolCallId: 'c1', toolName: 'mcp__fs__read_file' }, t)).toBe(
      'read_file'
    )
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

describe('resolveCompanionAskPresentation', () => {
  it('turns companion_ask JSON into question and selected option', () => {
    const presentation = resolveToolResultPresentation({
      toolName: 'companion_ask',
      args: {
        question: '新建一个文件夹是指？',
        options: ['按模板初始化完整写作目录结构', '只创建一个空文件夹']
      },
      result: JSON.stringify({
        approved: true,
        question: '新建一个文件夹是指？',
        answer: '按模板初始化完整写作目录结构',
        selectedOptionIds: ['0']
      })
    })

    expect(presentation.mode).toBe('companion_ask')
    if (presentation.mode !== 'companion_ask') return
    expect(presentation.question).toBe('新建一个文件夹是指？')
    expect(presentation.answer).toBe('按模板初始化完整写作目录结构')
    expect(presentation.declined).toBe(false)
    expect(presentation.options.map((option) => option.label)).toEqual([
      '按模板初始化完整写作目录结构',
      '只创建一个空文件夹'
    ])
    expect(presentation.selectedOptionIds).toEqual(['0'])
  })

  it('treats User declined to answer as declined, not raw English', () => {
    const presentation = resolveToolResultPresentation({
      toolName: 'companion_ask',
      args: { question: '继续吗？', options: ['是', '否'] },
      result: 'User declined to answer.'
    })

    expect(presentation.mode).toBe('companion_ask')
    if (presentation.mode !== 'companion_ask') return
    expect(presentation.declined).toBe(true)
    expect(presentation.answer).toBeNull()
  })

  it('uses custom feedback text as the answer', () => {
    const presentation = resolveToolResultPresentation({
      toolName: 'companion_ask',
      args: { question: '选哪个？', options: ['A', 'B'] },
      result: '我想两个都要'
    })

    expect(presentation.mode).toBe('companion_ask')
    if (presentation.mode !== 'companion_ask') return
    expect(presentation.answer).toBe('我想两个都要')
    expect(presentation.options.some((option) => option.label === '我想两个都要')).toBe(true)
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

  it('treats Tool execution failed without a colon as an error', () => {
    const presentation = resolveToolResultPresentation({
      toolName: 'skill_write',
      result: 'Tool execution failed'
    })
    expect(presentation.mode).toBe('error')
    if (presentation.mode !== 'error') return
    expect(presentation.text).toBe('Tool execution failed')
  })
})

describe('localizeToolResultText', () => {
  it('translates a companion_ask decline', () => {
    expect(localizeToolResultText('User declined to answer.', passthroughT)).toBe('没有作答')
  })

  it('translates a bare execution failure', () => {
    expect(localizeToolResultText('Tool execution failed', passthroughT)).toBe('工具执行失败')
  })

  it('translates an execution failure with detail', () => {
    expect(localizeToolResultText('Tool execution failed: network down', passthroughT)).toBe(
      '工具执行失败：network down'
    )
  })

  it('translates skill save success lines', () => {
    expect(
      localizeToolResultText(
        'Saved skill "daily-news".\nLocation: AI/skills/daily-news/SKILL.md\nDescription: 整理新闻',
        passthroughT
      )
    ).toBe('已保存技能「daily-news」。\n位置：AI/skills/daily-news/SKILL.md\n说明：整理新闻')
  })
})

describe('getToolRowSubtitle', () => {
  it('shows the selected companion_ask answer as subtitle', () => {
    expect(
      getToolRowSubtitle(
        {
          toolName: 'companion_ask',
          args: { question: '新建一个文件夹是指？', options: ['按模板初始化', '只建空目录'] },
          result: JSON.stringify({
            approved: true,
            question: '新建一个文件夹是指？',
            answer: '按模板初始化',
            selectedOptionIds: ['0']
          })
        },
        'success',
        passthroughT
      )
    ).toBe('按模板初始化')
  })

  it('shows localized error text when the tool failed', () => {
    expect(
      getToolRowSubtitle(
        {
          toolName: 'skill_write',
          args: { name: 'daily-news', description: '很长的技能说明' },
          result: 'Tool execution failed'
        },
        'error',
        passthroughT
      )
    ).toBe('工具执行失败')
  })
})

describe('knowledge_search presentation', () => {
  it('unwraps formatted text from citation JSON', () => {
    const presentation = resolveToolResultPresentation({
      toolName: 'knowledge_search',
      result: JSON.stringify({
        text: '## 知识库检索\n\n[1] 手册 · 视听语言（偏移 12）',
        citations: [{ notebookName: '手册', title: '视听语言', offset: 12 }]
      })
    })
    expect(presentation.mode).toBe('plain')
    if (presentation.mode !== 'plain') return
    expect(presentation.renderAsMarkdown).toBe(true)
    expect(presentation.text).toContain('视听语言')
  })
})
