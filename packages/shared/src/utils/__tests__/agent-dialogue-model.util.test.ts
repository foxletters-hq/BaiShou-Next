import { describe, expect, it } from 'vitest'
import {
  buildAgentDialogueSelectionState,
  coalesceConfiguredId,
  detectDialogueSelectionSwitches,
  formatDialogueModelLabel,
  isConfiguredDialogueModelId,
  requireResolvedDialogueModel,
  resolveDialogueModelSelection,
  resolveProviderListDialogueFallback,
  resolveStreamDialogueModelId,
  requireStreamDialogueModelId,
  toStorageDialogueIds,
  UNCONFIGURED_DIALOGUE_MODEL_SENTINEL
} from '../agent-dialogue-model.util'

describe('resolveDialogueModelSelection', () => {
  it('prefers assistant model when both provider and model are set', () => {
    expect(
      resolveDialogueModelSelection({
        assistantProviderId: 'openai',
        assistantModelId: 'gpt-4o',
        requestedProviderId: 'anthropic',
        requestedModelId: 'claude-3-5-sonnet',
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-2.5-pro'
      })
    ).toEqual({
      providerId: 'openai',
      modelId: 'gpt-4o',
      source: 'assistant'
    })
  })

  it('uses requested model when assistant is unset', () => {
    expect(
      resolveDialogueModelSelection({
        assistantProviderId: 'off',
        assistantModelId: '',
        requestedProviderId: 'anthropic',
        requestedModelId: 'claude-3-5-sonnet',
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-2.5-pro'
      })
    ).toEqual({
      providerId: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      source: 'requested'
    })
  })

  it('falls back to global dialogue model when assistant and requested are unset', () => {
    expect(
      resolveDialogueModelSelection({
        assistantProviderId: '',
        assistantModelId: 'off',
        requestedProviderId: 'unknown',
        requestedModelId: 'off',
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

  it('returns none when assistant, requested, and global are unset', () => {
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

  it('uses provider list fallback only when explicitly provided and chain is none', () => {
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

  it('does not use fallback when global is configured', () => {
    expect(
      resolveDialogueModelSelection({
        globalDialogueProviderId: 'openai',
        globalDialogueModelId: 'gpt-4o',
        fallbackProviderId: 'ollama',
        fallbackModelId: 'llama3'
      })
    ).toEqual({
      providerId: 'openai',
      modelId: 'gpt-4o',
      source: 'global'
    })
  })
})

describe('requireResolvedDialogueModel', () => {
  it('returns resolved pair when configured', () => {
    expect(
      requireResolvedDialogueModel({
        requestedProviderId: 'openai',
        requestedModelId: 'gpt-4o'
      })
    ).toEqual({
      providerId: 'openai',
      modelId: 'gpt-4o',
      source: 'requested'
    })
  })

  it('throws when resolution is none', () => {
    expect(() =>
      requireResolvedDialogueModel({
        globalDialogueModelId: 'off'
      })
    ).toThrow(/未配置对话模型/)
  })
})

describe('toStorageDialogueIds', () => {
  it('maps none to unknown sentinel', () => {
    expect(toStorageDialogueIds({ providerId: null, modelId: null, source: 'none' })).toEqual({
      providerId: UNCONFIGURED_DIALOGUE_MODEL_SENTINEL,
      modelId: UNCONFIGURED_DIALOGUE_MODEL_SENTINEL
    })
  })
})

describe('detectDialogueSelectionSwitches', () => {
  it('emits assistant and model events when both change', () => {
    const previous = buildAgentDialogueSelectionState({
      assistantId: 'a1',
      resolved: { providerId: 'openai', modelId: 'gpt-4o', source: 'assistant' }
    })
    const next = buildAgentDialogueSelectionState({
      assistantId: 'a2',
      resolved: { providerId: 'gemini', modelId: 'gemini-flash', source: 'global' }
    })

    const events = detectDialogueSelectionSwitches(previous, next, 'sess-1')
    expect(events).toHaveLength(2)
    expect(events[0]?.kind).toBe('assistant')
    expect(events[1]?.kind).toBe('model')
    expect(events[0]?.sessionId).toBe('sess-1')
  })

  it('emits only model event when assistant unchanged', () => {
    const previous = buildAgentDialogueSelectionState({
      assistantId: 'a1',
      resolved: { providerId: 'openai', modelId: 'gpt-4o', source: 'requested' }
    })
    const next = buildAgentDialogueSelectionState({
      assistantId: 'a1',
      resolved: { providerId: 'openai', modelId: 'gpt-4o-mini', source: 'requested' }
    })

    const events = detectDialogueSelectionSwitches(previous, next)
    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('model')
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

  it('skips placeholder models in enabledModels and uses models list', () => {
    expect(
      resolveProviderListDialogueFallback([
        {
          id: 'siliconflow',
          isEnabled: true,
          enabledModels: ['off', 'unknown'],
          models: ['deepseek-v4-flash', 'embedding-model']
        }
      ])
    ).toEqual({ providerId: 'siliconflow', modelId: 'deepseek-v4-flash' })
  })
})

describe('resolveStreamDialogueModelId', () => {
  it('skips unknown and uses global dialogue model', () => {
    expect(resolveStreamDialogueModelId('unknown', 'deepseek-v4-flash')).toBe('deepseek-v4-flash')
  })

  it('falls back to null when all candidates invalid', () => {
    expect(resolveStreamDialogueModelId('unknown', 'off', '')).toBeNull()
  })
})

describe('requireStreamDialogueModelId', () => {
  it('returns configured model id', () => {
    expect(requireStreamDialogueModelId('unknown', 'gpt-4o')).toBe('gpt-4o')
  })

  it('throws when no configured model is available', () => {
    expect(() => requireStreamDialogueModelId('unknown', 'off', '')).toThrow(/未配置对话模型/)
  })
})

describe('coalesceConfiguredId', () => {
  it('returns first configured id', () => {
    expect(coalesceConfiguredId('unknown', 'default', 'gpt-4o')).toBe('gpt-4o')
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
