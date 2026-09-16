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

  it('should fall back to the dialogue model when graph is unset or off', () => {
    expect(
      resolveGlobalGraphModelIds({
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-pro',
        globalGraphProviderId: '',
        globalGraphModelId: 'off'
      })
    ).toEqual({ providerId: 'gemini', modelId: 'gemini-pro' })
  })

  it('should return empty ids when neither graph nor dialogue is configured', () => {
    expect(
      resolveGlobalGraphModelIds({
        globalDialogueProviderId: '',
        globalDialogueModelId: 'off'
      })
    ).toEqual({ providerId: undefined, modelId: '' })
  })
})
