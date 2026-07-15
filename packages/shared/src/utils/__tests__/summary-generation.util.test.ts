import { describe, expect, it } from 'vitest'
import {
  assembleSummaryGenerationPrompt,
  normalizeSummaryGenerationMode,
  resolveSummaryGenerationRuntime
} from '../summary-generation.util'

describe('normalizeSummaryGenerationMode', () => {
  it('defaults unknown values to prompt', () => {
    expect(normalizeSummaryGenerationMode(undefined)).toBe('prompt')
    expect(normalizeSummaryGenerationMode('')).toBe('prompt')
    expect(normalizeSummaryGenerationMode('other')).toBe('prompt')
  })

  it('accepts assistant mode', () => {
    expect(normalizeSummaryGenerationMode('assistant')).toBe('assistant')
  })
})

describe('resolveSummaryGenerationRuntime', () => {
  it('keeps prompt mode when fields are missing (legacy config compatibility)', () => {
    const runtime = resolveSummaryGenerationRuntime({}, null)
    expect(runtime.mode).toBe('prompt')
    expect(runtime.injectSharedMemoryBeforeGenerate).toBe(false)
    expect(runtime.fellBackToPrompt).toBe(false)
    expect(runtime.systemPrompt).toContain('回忆总结助手')
  })

  it('falls back to default custom system prompt when blank', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'prompt',
        promptLocale: 'en',
        customGenerationSystemPromptByLocale: { en: '   ' }
      },
      null
    )
    expect(runtime.systemPrompt).toContain('memory summary assistant')
  })

  it('uses custom generation system prompt in prompt mode', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'prompt',
        promptLocale: 'zh',
        customGenerationSystemPromptByLocale: {
          zh: '  你是自定义生成助手  ',
          en: 'You are a custom generator'
        }
      },
      null
    )
    expect(runtime.mode).toBe('prompt')
    expect(runtime.systemPrompt).toBe('你是自定义生成助手')
    expect(runtime.fellBackToPrompt).toBe(false)
  })

  it('ignores custom system prompt when assistant mode succeeds', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'assistant',
        generationAssistantId: 'ast-1',
        promptLocale: 'zh',
        customGenerationSystemPromptByLocale: { zh: '自定义不应生效' }
      },
      {
        id: 'ast-1',
        providerId: 'deepseek',
        modelId: 'deepseek-chat',
        systemPrompt: '伙伴人设'
      }
    )
    expect(runtime.mode).toBe('assistant')
    expect(runtime.systemPrompt).toBe('伙伴人设')
  })

  it('resolves assistant mode with model and system prompt', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'assistant',
        generationAssistantId: 'ast-1',
        injectSharedMemoryBeforeGenerate: true,
        sharedMemoryLookbackMonths: 3
      },
      {
        id: 'ast-1',
        providerId: 'deepseek',
        modelId: 'deepseek-chat',
        systemPrompt: '你是回忆伙伴'
      }
    )

    expect(runtime).toMatchObject({
      mode: 'assistant',
      providerId: 'deepseek',
      modelId: 'deepseek-chat',
      systemPrompt: '你是回忆伙伴',
      injectSharedMemoryBeforeGenerate: true,
      sharedMemoryLookbackMonths: 3,
      fellBackToPrompt: false
    })
  })

  it('falls back to prompt when assistant is missing', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'assistant',
        generationAssistantId: 'ast-missing'
      },
      null
    )
    expect(runtime.mode).toBe('prompt')
    expect(runtime.fellBackToPrompt).toBe(true)
  })

  it('falls back when assistant has no model', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'assistant',
        generationAssistantId: 'ast-1'
      },
      { id: 'ast-1', providerId: 'deepseek', modelId: null }
    )
    expect(runtime.mode).toBe('prompt')
    expect(runtime.fellBackToPrompt).toBe(true)
  })

  it('falls back when providers reject the assistant model', () => {
    const providers = [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        type: 'deepseek' as const,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com',
        models: ['deepseek-chat'],
        enabledModels: ['deepseek-chat'],
        defaultDialogueModel: '',
        defaultNamingModel: '',
        isEnabled: true,
        isSystem: true,
        sortOrder: 0
      }
    ]

    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'assistant',
        generationAssistantId: 'ast-1'
      },
      {
        id: 'ast-1',
        providerId: 'deepseek',
        modelId: 'other-model'
      },
      providers
    )

    expect(runtime.mode).toBe('prompt')
    expect(runtime.fellBackToPrompt).toBe(true)
  })

  it('keeps assistant mode when providers allow the model', () => {
    const providers = [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        type: 'deepseek' as const,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com',
        models: ['deepseek-chat'],
        enabledModels: ['deepseek-chat'],
        defaultDialogueModel: '',
        defaultNamingModel: '',
        isEnabled: true,
        isSystem: true,
        sortOrder: 0
      }
    ]

    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'assistant',
        generationAssistantId: 'ast-1'
      },
      {
        id: 'ast-1',
        providerId: 'deepseek',
        modelId: 'deepseek-chat',
        systemPrompt: 'persona'
      },
      providers
    )

    expect(runtime.mode).toBe('assistant')
    expect(runtime.fellBackToPrompt).toBe(false)
    expect(runtime.modelId).toBe('deepseek-chat')
  })
})

describe('assembleSummaryGenerationPrompt', () => {
  it('inserts shared memory between template and raw data when provided', () => {
    const prompt = assembleSummaryGenerationPrompt({
      promptTemplate: 'TEMPLATE',
      dataPrefix: 'RAW_PREFIX',
      contextData: 'PERIOD_DATA',
      sharedContextText: 'SHARED_MEMORY_BODY',
      promptLocale: 'zh'
    })

    expect(prompt).toContain('TEMPLATE')
    expect(prompt).toContain('SHARED_MEMORY_BODY')
    expect(prompt).toContain('共同回忆')
    expect(prompt).not.toContain('请你扮演')
    expect(prompt).toContain('RAW_PREFIX')
    expect(prompt).toContain('PERIOD_DATA')

    const sharedIdx = prompt.indexOf('SHARED_MEMORY_BODY')
    const rawIdx = prompt.indexOf('PERIOD_DATA')
    expect(sharedIdx).toBeGreaterThan(prompt.indexOf('TEMPLATE'))
    expect(rawIdx).toBeGreaterThan(sharedIdx)
  })

  it('does not treat copy-prefix style text as part of assembler input', () => {
    const prompt = assembleSummaryGenerationPrompt({
      promptTemplate: 'TEMPLATE',
      dataPrefix: 'RAW_PREFIX',
      contextData: 'PERIOD_DATA',
      sharedContextText: 'MEMORY_ONLY',
      promptLocale: 'zh'
    })
    expect(prompt).toContain('MEMORY_ONLY')
    expect(prompt).not.toMatch(/sharedMemoryCopyPrefix/)
  })

  it('skips shared section when empty', () => {
    const prompt = assembleSummaryGenerationPrompt({
      promptTemplate: 'TEMPLATE',
      dataPrefix: 'RAW_PREFIX',
      contextData: 'PERIOD_DATA',
      sharedContextText: '   ',
      promptLocale: 'zh'
    })
    expect(prompt).not.toContain('共同回忆')
    expect(prompt).toBe('TEMPLATE\n\n---\n\nRAW_PREFIX\n\nPERIOD_DATA')
  })
})
