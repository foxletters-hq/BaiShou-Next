import { describe, expect, it } from 'vitest'
import { getDefaultCustomGenerationSystemPrompt } from '../../constants/summary-generation-system-prompt.defaults'
import {
  resolveCustomGenerationSystemPrompt,
  resolveSummaryGenerationRuntime
} from '../summary-generation.util'
import {
  getDefaultSummaryTemplate,
  resolveSummaryTemplatesForGeneration
} from '../summary-template.util'

/**
 * 模拟设置页选项 → 生成参数的映射，确保按钮/开关对应的配置会被生成链路消费。
 * （桌面/移动 resolve*SummaryGenerateOptions 依赖 IPC，此处测共享解析核心。）
 */
describe('summary settings → generation options mapping', () => {
  it('maps custom prompt mode to default system prompt when user left it blank', () => {
    const runtime = resolveSummaryGenerationRuntime(
      { generationMode: 'prompt', promptLocale: 'zh' },
      null
    )
    expect(runtime.mode).toBe('prompt')
    expect(runtime.systemPrompt).toBe(getDefaultCustomGenerationSystemPrompt('zh'))
    expect(runtime.systemPrompt).toContain('回忆总结助手')
  })

  it('maps custom prompt mode to user system prompt when provided', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'prompt',
        promptLocale: 'zh',
        customGenerationSystemPromptByLocale: { zh: '我的自定义助手' }
      },
      null
    )
    expect(runtime.systemPrompt).toBe('我的自定义助手')
  })

  it('maps partner mode to partner model + system, ignoring custom system prompt', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'assistant',
        generationAssistantId: 'ast-1',
        customGenerationSystemPromptByLocale: { zh: '自定义不应出现' }
      },
      {
        id: 'ast-1',
        providerId: 'deepseek',
        modelId: 'deepseek-chat',
        systemPrompt: '伙伴人设正文'
      }
    )
    expect(runtime).toMatchObject({
      mode: 'assistant',
      systemPrompt: '伙伴人设正文',
      fellBackToPrompt: false
    })
    expect(runtime.modelId).toBeUndefined()
    expect(runtime.providerId).toBeUndefined()
    expect(runtime.systemPrompt).not.toContain('自定义不应出现')
  })

  it('maps inject shared memory flag and lookback months', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'prompt',
        injectSharedMemoryBeforeGenerate: true,
        sharedMemoryLookbackMonths: 6
      },
      null
    )
    expect(runtime.injectSharedMemoryBeforeGenerate).toBe(true)
    expect(runtime.sharedMemoryLookbackMonths).toBe(6)
  })

  it('default generation templates are format-only (no role preamble)', () => {
    const weekly = getDefaultSummaryTemplate('weekly', 'zh')
    expect(weekly).toContain('周总结')
    expect(weekly).not.toContain('你是一个专业的个人传记')
    expect(weekly).not.toContain('禁止输出任何问候语')

    const system = resolveCustomGenerationSystemPrompt({ generationMode: 'prompt' }, 'zh')
    expect(system).toContain('禁止问候')
    expect(system).toContain('生成总结模板')
  })

  it('resolveSummaryTemplatesForGeneration prefers user weekly template', () => {
    const templates = resolveSummaryTemplatesForGeneration({
      promptLocale: 'zh',
      instructionsByLocale: {
        zh: { weekly: '【用户周模板】{year}' }
      }
    })
    expect(templates.weekly).toBe('【用户周模板】{year}')
  })
})
