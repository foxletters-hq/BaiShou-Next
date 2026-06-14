import { describe, expect, it } from 'vitest'
import {
  formatDialogueModelLabel,
  isConfiguredDialogueModelId,
  resolveDialogueModelSelection,
  resolveProviderListDialogueFallback
} from '../agent-dialogue-model.util'

describe('resolveDialogueModelSelection', () => {
  it('prefers assistant model when both provider and model are set', () => {
    expect(
      resolveDialogueModelSelection({
        assistantProviderId: 'openai',
        assistantModelId: 'gpt-4o',
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-2.5-pro'
      })
    ).toEqual({
      providerId: 'openai',
      modelId: 'gpt-4o',
      source: 'assistant'
    })
  })

  it('falls back to global dialogue model when assistant has no model', () => {
    expect(
      resolveDialogueModelSelection({
        assistantProviderId: '',
        assistantModelId: 'off',
        globalDialogueProviderId: 'deepseek',
        globalDialogueModelId: 'deepseek-chat'
      })
    ).toEqual({
      providerId: 'deepseek',
      modelId: 'deepseek-chat',
      source: 'global'
    })
  })

  it('treats partial assistant config as unset and uses global', () => {
    expect(
      resolveDialogueModelSelection({
        assistantProviderId: 'openai',
        assistantModelId: 'off',
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-2.5-flash'
      })
    ).toEqual({
      providerId: 'gemini',
      modelId: 'gemini-2.5-flash',
      source: 'global'
    })
  })

  it('returns none when assistant and global are unset', () => {
    expect(
      resolveDialogueModelSelection({
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'off'
      })
    ).toEqual({
      providerId: null,
      modelId: null,
      source: 'none'
    })
  })

  it('uses provider list fallback when provided', () => {
    expect(
      resolveDialogueModelSelection({
        fallbackProviderId: 'ollama',
        fallbackModelId: 'llama3'
      })
    ).toEqual({
      providerId: 'ollama',
      modelId: 'llama3',
      source: 'fallback'
    })
  })
})

describe('resolveProviderListDialogueFallback', () => {
  it('picks first enabled provider and its first enabled model', () => {
    expect(
      resolveProviderListDialogueFallback([
        { id: 'disabled', isEnabled: false, enabledModels: ['x'], models: ['x'] },
        { id: 'openai', isEnabled: true, enabledModels: ['gpt-4o'], models: ['gpt-4o'] }
      ])
    ).toEqual({ providerId: 'openai', modelId: 'gpt-4o' })
  })
})

describe('formatDialogueModelLabel', () => {
  it('returns null for unset sentinels', () => {
    expect(formatDialogueModelLabel('off')).toBeNull()
    expect(formatDialogueModelLabel('unknown')).toBeNull()
    expect(formatDialogueModelLabel(null)).toBeNull()
  })

  it('returns trimmed model id when configured', () => {
    expect(formatDialogueModelLabel(' gpt-4o ')).toBe('gpt-4o')
  })
})

describe('isConfiguredDialogueModelId', () => {
  it('rejects empty and placeholder values', () => {
    expect(isConfiguredDialogueModelId('')).toBe(false)
    expect(isConfiguredDialogueModelId('default')).toBe(false)
    expect(isConfiguredDialogueModelId('deepseek-chat')).toBe(true)
  })
})
