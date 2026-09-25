import { describe, expect, it } from 'vitest'
import { resolveGlobalGraphModelIds } from '../global-graph-model.util'

describe('resolveGlobalGraphModelIds', () => {
  it('should use the dedicated graph model when it is configured', () => {
    expect(
      resolveGlobalGraphModelIds({
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-pro',
        globalGraphProviderId: 'deepseek',
        globalGraphModelId: 'deepseek-chat'
      })
    ).toEqual({ providerId: 'deepseek', modelId: 'deepseek-chat' })
  })

  it('should stay empty when the graph slot is unset even if dialogue is configured', () => {
    expect(
      resolveGlobalGraphModelIds({
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-pro',
        globalGraphProviderId: '',
        globalGraphModelId: 'off'
      })
    ).toEqual({ providerId: undefined, modelId: '' })
  })

  it('should return the graph model without a provider when only the model id is set', () => {
    expect(
      resolveGlobalGraphModelIds({
        globalGraphProviderId: '',
        globalGraphModelId: 'deepseek-chat',
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-pro'
      })
    ).toEqual({ providerId: undefined, modelId: 'deepseek-chat' })
  })
})
