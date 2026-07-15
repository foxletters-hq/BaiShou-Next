import { describe, it, expect } from 'vitest'
import { SystemPromptBuilder } from '../agent/system-prompt.builder'
import { MESSAGE_CONTENT_TAG, MESSAGE_TIME_TAG } from '@baishou/shared'

function sectionOrder(prompt: string, tags: string[]): number[] {
  return tags.map((tag) => prompt.indexOf(`<${tag}>`))
}

describe('SystemPromptBuilder', () => {
  it('emits layered sections with output_protocol and context_encoding', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      tools: {},
      customPersona: 'You are a test persona.'
    })

    expect(prompt).toContain('<assistant_persona>')
    expect(prompt).toContain('<output_protocol>')
    expect(prompt).toContain('<runtime_context>')
    expect(prompt).toContain('<context_encoding>')
    expect(prompt).toContain('[System Current Date / Time]')
    expect(prompt).toContain(`<${MESSAGE_TIME_TAG}>`)
    expect(prompt).toContain(`<${MESSAGE_CONTENT_TAG}>`)
    expect(prompt).toContain('[Forbidden in user-visible text]')
    expect(prompt).toContain('<reply>')
    expect(prompt).toContain('<response>')
    expect(prompt).toContain('plain natural language only')
    expect(prompt).not.toContain('<system_context>')

    const order = sectionOrder(prompt, [
      'assistant_persona',
      'output_protocol',
      'runtime_context',
      'context_encoding',
      'assistant_capabilities',
      'available_tools'
    ])
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]!)
    }
  })

  it('omits context_encoding and system time when injectCurrentTime is false', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      tools: {},
      injectCurrentTime: false
    })

    expect(prompt).toContain('<runtime_context>')
    expect(prompt).not.toContain('[System Current Date / Time]')
    expect(prompt).not.toContain('<context_encoding>')
    expect(prompt).not.toContain('[Historical messages]')
    expect(prompt).toContain('**current_time** tool')
    expect(prompt).toContain('[Current Vault / Workspace]: Personal')
    expect(prompt).toContain('<output_protocol>')
  })

  it('localizes web-search-disabled copy from locale instead of hardcoding Chinese', () => {
    const zhPrompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      tools: { diary_read: { description: 'Read diary' } },
      locale: 'zh'
    })
    expect(zhPrompt).toContain('reply with exactly:')
    expect(zhPrompt).toContain('您还未启用网络搜索，请在工具栏开启后重试。')
    expect(zhPrompt).not.toContain('reply in Chinese')

    const enPrompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      tools: { diary_read: { description: 'Read diary' } },
      locale: 'en'
    })
    expect(enPrompt).toContain('Web search not enabled. Please enable it in the toolbar.')
    expect(enPrompt).not.toContain('您还未启用网络搜索')
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
    expect(prompt).toContain('编辑日记前先读取')
    expect(prompt).not.toContain('会被系统拒绝')
    expect(prompt).not.toContain('All tools are optional')
  })

  it('documents work partner with stable enum and localized label', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      assistantKind: 'work',
      locale: 'en',
      tools: {
        web_search: { description: 'Web search' },
        current_time: { description: 'Current time' }
      }
    })

    expect(prompt).toContain('Partner type: work (Work).')
    expect(prompt).toContain('[Partner type]: work')
    expect(prompt).not.toContain('工作伙伴')
    expect(prompt).not.toContain('<tool_usage_guidelines>')
    expect(prompt).not.toContain('查事实，禁止装懂')
  })

  it('documents companion partner with diary guidelines', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      assistantKind: 'companion',
      locale: 'en',
      tools: {
        diary_search: { description: 'Search diary' },
        diary_read: { description: 'Read diary' }
      }
    })

    expect(prompt).toContain('Partner type: companion (Companion).')
    expect(prompt).toContain('[Partner type]: companion')
    expect(prompt).not.toContain('亲密伙伴')
    expect(prompt).toContain('<tool_usage_guidelines>')
  })

  it('places user_identity after context_encoding and before capabilities', () => {
    const prompt = SystemPromptBuilder.build({
      vaultName: 'Personal',
      tools: {},
      userProfileBlock: 'Name: Alice'
    })

    const order = sectionOrder(prompt, [
      'output_protocol',
      'runtime_context',
      'context_encoding',
      'user_identity',
      'assistant_capabilities'
    ])
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]!)
    }
    expect(prompt).toContain('Name: Alice')
  })
})
