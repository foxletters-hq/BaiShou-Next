import { describe, expect, it } from 'vitest'
import {
  resolveReasoningApiShape,
  shouldUseOpenAiResponsesLanguageModel
} from '../reasoning-api-shape'
import { listReasoningVariants } from '../reasoning-variants'
import {
  buildReasoningProviderOptions,
  buildReasoningProviderOptionsResult,
  shouldForceChatCompletionsReasoningNone
} from '../reasoning-provider-options'

describe('reasoning adapters', () => {
  it('routes openai reasoning models to responses', () => {
    expect(
      resolveReasoningApiShape({ modelId: 'gpt-5.6-sol', providerType: 'openai' })
    ).toBe('responses')
    expect(
      shouldUseOpenAiResponsesLanguageModel({
        modelId: 'gpt-5.6-sol',
        providerType: 'openai'
      })
    ).toBe(true)
  })

  it('keeps siliconflow / deepseek on chat', () => {
    expect(
      resolveReasoningApiShape({ modelId: 'gpt-5', providerType: 'siliconflow' })
    ).toBe('chat')
    expect(
      resolveReasoningApiShape({
        modelId: 'deepseek-reasoner',
        providerType: 'deepseek',
        baseUrl: 'https://api.deepseek.com'
      })
    ).toBe('none')
  })

  it('builds openai responses options with encrypted include', () => {
    const opts = buildReasoningProviderOptions({
      modelId: 'gpt-5',
      providerType: 'openai',
      effort: 'medium'
    })
    expect(opts?.openai).toMatchObject({
      reasoningEffort: 'medium',
      reasoningSummary: 'auto',
      include: ['reasoning.encrypted_content'],
      store: false
    })
  })

  it('forces none for chat+tools', () => {
    expect(
      shouldForceChatCompletionsReasoningNone({
        modelId: 'gpt-5',
        hasTools: true,
        apiShape: 'chat'
      })
    ).toBe(true)
    expect(
      shouldForceChatCompletionsReasoningNone({
        modelId: 'gpt-5',
        hasTools: true,
        apiShape: 'responses'
      })
    ).toBe(false)
  })

  it('lists variants for anthropic and gemini', () => {
    expect(
      listReasoningVariants({ modelId: 'claude-sonnet-4-6', providerType: 'anthropic' }).map(
        (v) => v.id
      )
    ).toEqual(expect.arrayContaining(['low', 'high', 'max']))
    expect(
      listReasoningVariants({ modelId: 'gemini-2.5-flash', providerType: 'gemini' }).map(
        (v) => v.id
      )
    ).toEqual(['high', 'max'])
  })

  it('builds openrouter reasoning dialect via body inject', () => {
    expect(
      resolveReasoningApiShape({ modelId: 'gpt-5', providerType: 'openrouter' })
    ).toBe('openrouter')
    const built = buildReasoningProviderOptionsResult({
      modelId: 'gpt-5',
      providerType: 'openrouter',
      effort: 'high'
    })
    expect(built.providerOptions).toBeUndefined()
    expect(built.openAiThinkingInject).toEqual({
      openRouterReasoning: { effort: 'high' }
    })
  })

  it('builds glm-5.2 chat efforts', () => {
    const variants = listReasoningVariants({
      modelId: 'glm-5.2',
      providerType: 'zhipu'
    })
    expect(variants.map((v) => v.id)).toEqual(expect.arrayContaining(['high', 'max']))
  })

  it('routes kimi / dashscope toggle models to chat inject', () => {
    expect(resolveReasoningApiShape({ modelId: 'kimi-k2.5', providerType: 'opencodego' })).toBe(
      'chat'
    )
    expect(resolveReasoningApiShape({ modelId: 'qwen-plus', providerType: 'dashscope' })).toBe(
      'chat'
    )

    const off = buildReasoningProviderOptionsResult({
      modelId: 'kimi-k2.5',
      providerType: 'opencodego',
      effort: 'none'
    })
    expect(off.providerOptions).toBeUndefined()
    expect(off.openAiThinkingInject).toEqual({
      enableThinking: true,
      budgetTokens: 81920
    })

    const on = buildReasoningProviderOptionsResult({
      modelId: 'kimi-k2.5',
      providerType: 'opencodego',
      effort: 'high'
    })
    expect(on.openAiThinkingInject).toEqual({
      enableThinking: true,
      budgetTokens: 81920
    })

    const auto = buildReasoningProviderOptionsResult({
      modelId: 'qwen-plus',
      providerType: 'dashscope',
      effort: 'auto'
    })
    // 通义无预算上限：仍注入开启
    expect(auto.openAiThinkingInject).toEqual({ enableThinking: true })

    const kimiAuto = buildReasoningProviderOptionsResult({
      modelId: 'kimi-k2.5',
      providerType: 'opencodego',
      effort: 'auto'
    })
    expect(kimiAuto.openAiThinkingInject).toEqual({
      enableThinking: true,
      budgetTokens: 81920
    })
  })

  it('passes deepseek-v4 max via openaiCompatible providerOptions', () => {
    expect(
      resolveReasoningApiShape({
        modelId: 'deepseek-v4-flash',
        providerType: 'deepseek',
        baseUrl: 'https://api.deepseek.com'
      })
    ).toBe('chat')

    const built = buildReasoningProviderOptionsResult({
      modelId: 'deepseek-v4-flash',
      providerType: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      effort: 'max'
    })
    expect(built.openAiThinkingInject).toBeUndefined()
    expect(built.providerOptions).toEqual({
      openaiCompatible: { reasoningEffort: 'max' }
    })
  })

  it('passes deepseek-v4 high via openaiCompatible providerOptions', () => {
    const built = buildReasoningProviderOptionsResult({
      modelId: 'deepseek-v4-flash',
      providerType: 'deepseek',
      effort: 'high'
    })
    expect(built.openAiThinkingInject).toBeUndefined()
    expect(built.providerOptions).toEqual({
      openaiCompatible: { reasoningEffort: 'high' }
    })
  })

  it('never passes openai.reasoningEffort providerOptions on chat path', () => {
    const built = buildReasoningProviderOptionsResult({
      modelId: 'gpt-5',
      providerType: 'siliconflow',
      effort: 'medium'
    })
    expect(built.providerOptions).toEqual({
      openaiCompatible: { reasoningEffort: 'medium' }
    })
    expect(built.providerOptions?.openai).toBeUndefined()
  })

  it('routes grok-3-mini to openaiCompatible providerOptions', () => {
    expect(
      resolveReasoningApiShape({ modelId: 'grok-3-mini', providerType: 'grok' })
    ).toBe('chat')
    const built = buildReasoningProviderOptionsResult({
      modelId: 'grok-3-mini',
      providerType: 'grok',
      effort: 'high'
    })
    expect(built.providerOptions).toEqual({
      openaiCompatible: { reasoningEffort: 'high' }
    })
  })

  it('forces chat for openai-style models on non-official base URL', () => {
    expect(
      resolveReasoningApiShape({
        modelId: 'gpt-5',
        providerType: 'openai',
        baseUrl: 'https://opencode.example/v1'
      })
    ).toBe('chat')
  })

  it('uses minimax-m3 thinking type inject on chat', () => {
    const built = buildReasoningProviderOptionsResult({
      modelId: 'minimax-m3',
      providerType: 'minimax',
      effort: 'high'
    })
    expect(built.openAiThinkingInject).toEqual({ thinkingType: 'adaptive' })
  })
})
