import { describe, expect, it } from 'vitest'
import {
  isReasoningCapableModel,
  listOpenAiStyleReasoningEfforts,
  listAnthropicReasoningEfforts,
  listGeminiReasoningEfforts,
  listDeepSeekReasoningEfforts,
  listReasoningBudgetPresets,
  getReasoningControlForModel,
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

  it('exposes kimi toggle + budget control', () => {
    expect(isKimiThinkingControlModel('kimi-k2.6')).toBe(true)
    const ctl = getReasoningControlForModel('kimi-k2.6', 'opencodego')
    expect(ctl.mode).toBe('toggle')
    expect(ctl.supportsToggle).toBe(true)
    expect(ctl.supportsBudget).toBe(true)
    expect(ctl.maxBudgetTokens).toBe(81920)
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

  it('lists budget presets capped by max', () => {
    expect(listReasoningBudgetPresets(10000)).toEqual([4000, 8000, 10000])
    expect(listReasoningBudgetPresets(8000)).toEqual([4000, 8000])
    expect(listReasoningBudgetPresets(81920)).toContain(81920)
  })
})
