import { describe, expect, it } from 'vitest'
import { getDefaultLatteAssistantSystemPrompt } from '../../constants/latte-assistant-prompt.defaults'
import {
  assembleSummaryGenerationPrompt,
  buildSummaryIdentitySystemPrompt,
  normalizeSummaryGenerationMode,
  pickPreferredSummaryAssistant,
  resolveSummaryCompanionName,
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
    expect(runtime.modelId).toBeUndefined()
    expect(runtime.providerId).toBeUndefined()
  })

  it('reuses assistant system prompt only and never partner model ids', () => {
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
      systemPrompt: '你是回忆伙伴',
      injectSharedMemoryBeforeGenerate: true,
      sharedMemoryLookbackMonths: 3,
      fellBackToPrompt: false
    })
    expect(runtime.modelId).toBeUndefined()
    expect(runtime.providerId).toBeUndefined()
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

  it('still reuses persona when partner has no bound model', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'assistant',
        generationAssistantId: 'ast-1'
      },
      {
        id: 'ast-1',
        providerId: null,
        modelId: null,
        systemPrompt: '伙伴人设 Latte'
      }
    )
    expect(runtime.mode).toBe('assistant')
    expect(runtime.systemPrompt).toBe('伙伴人设 Latte')
    expect(runtime.modelId).toBeUndefined()
    expect(runtime.fellBackToPrompt).toBe(false)
  })

  it('normalizes legacy default assistant id to latte and combines customSystemPrompt + renamed persona', () => {
    const runtime = resolveSummaryGenerationRuntime(
      {
        generationMode: 'assistant',
        generationAssistantId: 'default'
      },
      {
        id: 'latte',
        name: '酒狐',
        systemPrompt: getDefaultLatteAssistantSystemPrompt('zh'),
        customSystemPrompt: '你是一只喜欢酿酒的狐狸精。'
      }
    )
    expect(runtime.mode).toBe('assistant')
    expect(runtime.fellBackToPrompt).toBe(false)
    expect(runtime.systemPrompt).toContain('你是 酒狐。')
    expect(runtime.systemPrompt).toContain('你是一只喜欢酿酒的狐狸精。')
    expect(runtime.systemPrompt).not.toContain('你是 Latte（拉提）')
  })
})

describe('pickPreferredSummaryAssistant & resolveSummaryCompanionName', () => {
  it('prefers user-created companion (e.g. 酒狐) over unmodified system Latte with isDefault=true', () => {
    const assistants = [
      {
        id: 'latte',
        name: 'Latte',
        isDefault: true,
        isPinned: false,
        sortOrder: 0,
        assistantKind: 'companion'
      },
      {
        id: 'ast-jiuhu',
        name: '酒狐',
        isDefault: false,
        isPinned: false,
        sortOrder: 1,
        assistantKind: 'companion'
      }
    ]
    expect(pickPreferredSummaryAssistant(assistants)?.id).toBe('ast-jiuhu')
    expect(resolveSummaryCompanionName(assistants, null)).toBe('酒狐')
  })

  it('prefers renamed system Latte (e.g. 酒狐) when user renamed the default partner in place', () => {
    const assistants = [
      {
        id: 'latte',
        name: '酒狐',
        isDefault: true,
        assistantKind: 'companion'
      }
    ]
    expect(pickPreferredSummaryAssistant(assistants)?.name).toBe('酒狐')
    expect(resolveSummaryCompanionName(assistants, null)).toBe('酒狐')
  })

  it('includes custom companion name alongside Latte if unmodified Latte is explicitly selected while custom companions exist', () => {
    const latte = {
      id: 'latte',
      name: 'Latte',
      isDefault: true,
      assistantKind: 'companion'
    }
    const jiuhu = {
      id: 'ast-jiuhu',
      name: '酒狐',
      isDefault: false,
      assistantKind: 'companion'
    }
    expect(resolveSummaryCompanionName([latte, jiuhu], latte)).toBe('酒狐 / Latte')
  })

  it('falls back to Latte when only unmodified system Latte exists', () => {
    const assistants = [
      {
        id: 'latte',
        name: 'Latte',
        isDefault: true,
        assistantKind: 'companion'
      }
    ]
    expect(pickPreferredSummaryAssistant(assistants)?.id).toBe('latte')
    expect(resolveSummaryCompanionName(assistants, null)).toBe('Latte')
  })
})

describe('buildSummaryIdentitySystemPrompt', () => {
  it('states user role explicitly and blocks default-name confusion in neutral prompt mode without companion', () => {
    const prompt = buildSummaryIdentitySystemPrompt({
      userName: '小满',
      userCard: '[User Identity Card]\n- 职业: 设计师',
      locale: 'zh'
    })
    expect(prompt).toContain('日记作者 / 用户：小满')
    expect(prompt).not.toContain('- AI 伙伴：')
    expect(prompt).toContain('素材中的第一人称「我」指用户本人。')
    expect(prompt).toContain('不要套用应用名或系统默认名')
    expect(prompt).toContain(
      '素材中出现的所有人物称呼与角色名字（包括用户提及的伙伴或助手）必须严格按原文保留'
    )
    expect(prompt).not.toContain('Latte')
    expect(prompt).not.toContain('白守')
    expect(prompt).toContain('职业: 设计师')
  })

  it('includes companion only when explicitly provided in assistant mode', () => {
    const prompt = buildSummaryIdentitySystemPrompt({
      userName: '小满',
      companionName: '酒狐',
      locale: 'zh'
    })
    expect(prompt).toContain('日记作者 / 用户：小满')
    expect(prompt).toContain('AI 伙伴：酒狐')
    expect(prompt).not.toContain('Latte')
  })

  it('falls back to localized user placeholder and supports English', () => {
    const prompt = buildSummaryIdentitySystemPrompt({ locale: 'en' })
    expect(prompt).toContain('Diary author / user: the user (no nickname set)')
    expect(prompt).not.toContain('AI companion:')
    expect(prompt).toContain('first-person “I” refers to the user')
    expect(prompt).toContain('Do not use the application name or default system name')
    expect(prompt).not.toContain('Latte')
    expect(prompt).not.toContain('BaiShou')
  })
})

describe('assembleSummaryGenerationPrompt', () => {
  it('labels template, shared memory, and period data as distinct sections', () => {
    const prompt = assembleSummaryGenerationPrompt({
      promptTemplate: 'TEMPLATE',
      dataPrefix: 'RAW_PREFIX',
      contextData: 'PERIOD_DATA',
      sharedContextText: 'SHARED_MEMORY_BODY',
      promptLocale: 'zh'
    })

    expect(prompt).toContain('## 生成总结模板')
    expect(prompt).toContain('输出版式')
    expect(prompt).toContain('TEMPLATE')
    expect(prompt).toContain('## 共同回忆（生成前注入）')
    expect(prompt).toContain('SHARED_MEMORY_BODY')
    expect(prompt).toContain('请先阅读并了解这些背景')
    expect(prompt).toContain('## 本期数据源')
    expect(prompt).toContain('RAW_PREFIX')
    expect(prompt).toContain('PERIOD_DATA')
    expect(prompt).not.toContain('请你扮演')

    const templateIdx = prompt.indexOf('## 生成总结模板')
    const sharedIdx = prompt.indexOf('SHARED_MEMORY_BODY')
    const periodIdx = prompt.indexOf('## 本期数据源')
    const rawIdx = prompt.indexOf('PERIOD_DATA')
    expect(templateIdx).toBeGreaterThanOrEqual(0)
    expect(sharedIdx).toBeGreaterThan(templateIdx)
    expect(periodIdx).toBeGreaterThan(sharedIdx)
    expect(rawIdx).toBeGreaterThan(periodIdx)
  })

  it('localizes shared-memory intro for English', () => {
    const prompt = assembleSummaryGenerationPrompt({
      promptTemplate: 'TEMPLATE',
      dataPrefix: 'RAW_PREFIX',
      contextData: 'PERIOD_DATA',
      sharedContextText: 'SHARED_MEMORY_BODY',
      promptLocale: 'en'
    })
    expect(prompt).toContain('## Summary Output Template')
    expect(prompt).toContain('## Shared Memory')
    expect(prompt).toContain('First read and understand that background')
    expect(prompt).toContain('## Period Data Sources')
    expect(prompt).not.toContain('请先阅读')
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
    expect(prompt).toContain('## 生成总结模板')
    expect(prompt).toContain('## 本期数据源')
    expect(prompt).toContain('TEMPLATE')
    expect(prompt).toContain('PERIOD_DATA')
  })
})
