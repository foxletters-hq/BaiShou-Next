import { describe, it, expect } from 'vitest'
import { SystemPromptBuilder } from '../agent/system-prompt.builder'
import { MESSAGE_CONTENT_TAG, MESSAGE_TIME_TAG } from '@baishou/shared'

describe('SystemPromptBuilder', () => {
  it('documents message metadata rules in English inside system_context', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      tools: {}
    })

    expect(prompt).toContain('<system_context>')
    expect(prompt).toContain('[System Current Date / Time]')
    expect(prompt).toContain(`<${MESSAGE_TIME_TAG}>`)
    expect(prompt).toContain(`<${MESSAGE_CONTENT_TAG}>`)
    expect(prompt).toContain('[Historical message format]')
    expect(prompt).toContain('[Output format]')
    expect(prompt).toContain('Never output')
    expect(prompt).toContain('plain natural language only')
  })

  it('omits system current time when injectCurrentTime is false', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      tools: {},
      injectCurrentTime: false
    })

    expect(prompt).toContain('<system_context>')
    expect(prompt).not.toContain('[System Current Date / Time]')
    expect(prompt).not.toContain('[Historical message format]')
    expect(prompt).toContain('**current_time** tool')
    expect(prompt).toContain('plain text without per-message timestamps')
    expect(prompt).toContain('[Current Vault / Workspace]: Personal')
  })

  it('frames web search disabled copy as a quoted user-facing Chinese sentence', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      tools: { diary_read: { description: 'Read diary' } }
    })

    expect(prompt).toContain('reply in Chinese with exactly:')
    expect(prompt).toContain('您还未启用网络搜索，请在工具栏开启后重试。')
  })

  it('injects tool usage guidelines when diary tools are available', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      tools: {
        diary_search: { description: 'Search diary' },
        vector_search: { description: 'Vector search' },
        diary_read: { description: 'Read diary' },
        diary_edit: { description: 'Edit diary' }
      }
    })

    expect(prompt).toContain('<tool_usage_guidelines>')
    expect(prompt).toContain('查事实，禁止装懂')
    expect(prompt).toContain('编辑日记前先读取（强制）')
    expect(prompt).not.toContain('All tools are optional')
  })

  it('documents work partner boundaries without diary lookup rules', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      assistantKind: 'work',
      tools: {
        web_search: { description: 'Web search' },
        current_time: { description: 'Current time' }
      }
    })

    expect(prompt).toContain('Work Partner (工作伙伴)')
    expect(prompt).not.toContain('<tool_usage_guidelines>')
    expect(prompt).not.toContain('查事实，禁止装懂')
  })

  it('documents companion partner with diary guidelines', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      assistantKind: 'companion',
      tools: {
        diary_search: { description: 'Search diary' },
        diary_read: { description: 'Read diary' }
      }
    })

    expect(prompt).toContain('Companion (亲密伙伴)')
    expect(prompt).toContain('<tool_usage_guidelines>')
  })
})
