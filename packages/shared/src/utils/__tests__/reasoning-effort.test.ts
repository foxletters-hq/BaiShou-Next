import { describe, expect, it } from 'vitest'
import {
  isReasoningCapableModel,
  listOpenAiStyleReasoningEfforts,
  listAnthropicReasoningEfforts,
  listGeminiReasoningEfforts,
  listDeepSeekReasoningEfforts,
  listReasoningBudgetPresets,
  getReasoningControlForModel,
  getReasoningBudgetBoundsForModel,
  resolveReasoningBudgetTiers,
  resolveReasoningBudgetTokens,
  mapLegacyReasoningBudgetTokensToEffort,
  normalizeReasoningEffortSetting,
  formatReasoningEffortLabel,
  pickWeakestReasoningEffort,
  isReasoningEffortBlacklistedModel,
  isKimiThinkingControlModel
} from '../reasoning-effort'
import { isOpenAiStyleReasoningModel } from '../model-capabilities'

describe('reasoning-effort', () => {
  it('normalizes settings', () => {
    expect(normalizeReasoningEffortSetting('auto')).toBe('auto')
    expect(normalizeReasoningEffortSetting('high')).toBe('high')
    expect(normalizeReasoningEffortSetting('nope')).toBe('auto')
  })

  it('formats effort labels in English without i18n', () => {
    expect(formatReasoningEffortLabel('auto')).toBe('Default')
    expect(formatReasoningEffortLabel('high')).toBe('high')
    expect(formatReasoningEffortLabel('xhigh')).toBe('xhigh')
  })

  it('lists openai efforts per model family', () => {
    expect(listOpenAiStyleReasoningEfforts('gpt-5')).toEqual([
      'minimal',
      'low',
      'medium',
      'high'
    ])
    expect(listOpenAiStyleReasoningEfforts('gpt-5.1')).toEqual([
      'none',
      'low',
      'medium',
      'high'
    ])
    expect(listOpenAiStyleReasoningEfforts('gpt-5.4')).toEqual([
      'none',
      'low',
      'medium',
      'high',
      'xhigh'
    ])
    expect(listOpenAiStyleReasoningEfforts('gpt-5.6-sol')).toEqual([
      'none',
      'low',
      'medium',
      'high',
      'xhigh',
      'max'
    ])
    expect(listOpenAiStyleReasoningEfforts('gpt-5.3-codex')).toEqual([
      'low',
      'medium',
      'high',
      'xhigh'
    ])
    expect(listOpenAiStyleReasoningEfforts('gpt-5.1-codex')).toEqual([
      'low',
      'medium',
      'high'
    ])
    expect(listOpenAiStyleReasoningEfforts('gpt-5.4-pro')).toEqual([
      'medium',
      'high',
      'xhigh'
    ])
    expect(listOpenAiStyleReasoningEfforts('gpt-5-pro')).toEqual(['high'])
    expect(listOpenAiStyleReasoningEfforts('o3-mini')).toEqual(['low', 'medium', 'high'])
    expect(listOpenAiStyleReasoningEfforts('gpt-4o')).toEqual([])
    expect(listOpenAiStyleReasoningEfforts('gpt-5-chat-latest')).toEqual([])
    expect(listOpenAiStyleReasoningEfforts('gpt-5.1-chat-latest')).toEqual([])
    expect(isOpenAiStyleReasoningModel('gpt-5.1-chat-latest')).toBe(false)
  })

  it('blacklists legacy deepseek but allows v4 effort UI', () => {
    expect(isReasoningEffortBlacklistedModel('deepseek-reasoner')).toBe(true)
    expect(isReasoningCapableModel('deepseek-reasoner', 'deepseek')).toBe(false)
    expect(isReasoningEffortBlacklistedModel('deepseek-v4-pro')).toBe(false)
    expect(isReasoningCapableModel('deepseek-v4-pro', 'opencodego')).toBe(true)
    expect(listDeepSeekReasoningEfforts('deepseek-v4-pro')).toEqual([
      'low',
      'medium',
      'high',
      'max'
    ])
  })

  it('exposes kimi budget-only high/max control', () => {
    expect(isKimiThinkingControlModel('kimi-k2.6')).toBe(true)
    const ctl = getReasoningControlForModel('kimi-k2.6', 'opencodego')
    expect(ctl.mode).toBe('effort')
    expect(ctl.efforts).toEqual(['high', 'max'])
    expect(ctl.supportsBudget).toBe(true)
    expect(ctl.catalogMax).toBe(81920)
    expect(ctl.maxBudgetTokens).toBe(81920)
    expect(ctl.supportsToggle).toBeUndefined()
  })

  it('dashscope qwen is toggle', () => {
    const ctl = getReasoningControlForModel('qwen-plus', 'dashscope')
    expect(ctl.mode).toBe('toggle')
    expect(ctl.supportsToggle).toBe(true)
  })

  it('lists anthropic and gemini efforts', () => {
    expect(listAnthropicReasoningEfforts('claude-sonnet-4-6')).toEqual([
      'low',
      'medium',
      'high',
      'max'
    ])
    expect(listAnthropicReasoningEfforts('claude-opus-4-7')).toEqual([
      'low',
      'medium',
      'high',
      'xhigh',
      'max'
    ])
    expect(listGeminiReasoningEfforts('gemini-2.5-pro')).toEqual(['high', 'max'])
    expect(listGeminiReasoningEfforts('gemini-3-flash')).toEqual([
      'minimal',
      'low',
      'medium',
      'high'
    ])
    expect(listGeminiReasoningEfforts('gemini-3-pro-preview')).toEqual(['low', 'high'])
    expect(listGeminiReasoningEfforts('gemini-3.1-pro')).toEqual(['low', 'medium', 'high'])
  })

  it('lists glm / minimax / grok efforts via control', () => {
    expect(getReasoningControlForModel('glm-5.2', 'zhipu').efforts).toEqual(['high', 'max'])
    expect(getReasoningControlForModel('minimax-m3', 'minimax').efforts).toEqual([
      'none',
      'high'
    ])
    expect(getReasoningControlForModel('grok-3-mini', 'grok').efforts).toEqual(['low', 'high'])
  })

  it('picks weakest effort', () => {
    expect(pickWeakestReasoningEffort(['high', 'none', 'low'])).toBe('none')
  })

  it('lists budget-only efforts instead of integer presets', () => {
    expect(listReasoningBudgetPresets(10000)).toEqual(['high', 'max'])
    expect(listReasoningBudgetPresets(81920)).toEqual(['high', 'max'])
    expect(listReasoningBudgetPresets()).not.toEqual(expect.arrayContaining([4000, 8000, 16000, 32000]))
  })

  it('resolves budget tokens from effort and bounds', () => {
    expect(
      resolveReasoningBudgetTiers({ catalogMin: 1024, catalogMax: 64000 })
    ).toEqual({ high: 16000, max: 31999 })
    expect(resolveReasoningBudgetTiers({ outputLimit: 5000 })).toEqual({ high: 2500, max: 4999 })
    expect(resolveReasoningBudgetTiers({ catalogMax: 24576 })).toEqual({ high: 12288, max: 24576 })
    expect(resolveReasoningBudgetTokens('high', { catalogMax: 24576 })).toBe(12288)
    expect(resolveReasoningBudgetTokens('max', { catalogMax: 24576 })).toBe(24576)
    expect(resolveReasoningBudgetTokens('auto')).toBeUndefined()
    expect(mapLegacyReasoningBudgetTokensToEffort(30000)).toBe('max')
    expect(mapLegacyReasoningBudgetTokensToEffort(16000)).toBe('high')
  })

  it('caps kimi at 32k on anthropic transport and keeps 81920 on native budget', () => {
    const native = getReasoningBudgetBoundsForModel('kimi-k2.6', { transport: 'native' })
    expect(resolveReasoningBudgetTiers(native)).toEqual({ high: 40960, max: 81920 })
    const anthropic = getReasoningBudgetBoundsForModel('kimi-k2.6', { transport: 'anthropic' })
    expect(resolveReasoningBudgetTiers(anthropic)).toEqual({ high: 16000, max: 31999 })
    expect(
      resolveReasoningBudgetTiers(
        getReasoningBudgetBoundsForModel('kimi-k2.6', { transport: 'native', outputLimit: 5000 })
      )
    ).toEqual({ high: 2500, max: 4999 })
  })

  it('attaches gemini 2.5 catalog max to effort control', () => {
    const flash = getReasoningControlForModel('gemini-2.5-flash', 'gemini')
    expect(flash.mode).toBe('effort')
    expect(flash.efforts).toEqual(['high', 'max'])
    expect(flash.catalogMax).toBe(24576)
    const pro = getReasoningControlForModel('gemini-2.5-pro', 'gemini')
    expect(pro.catalogMax).toBe(32768)
    expect(resolveReasoningBudgetTiers(getReasoningBudgetBoundsForModel('gemini-2.5-pro'))).toEqual({
      high: 16000,
      max: 31999
    })
  })
})
