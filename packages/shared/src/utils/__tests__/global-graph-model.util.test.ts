import { describe, expect, it } from 'vitest'
import { resolveGlobalGraphModelIds } from '../global-graph-model.util'

describe('resolveGlobalGraphModelIds', () => {
  it('always follows the dialogue model', () => {
    expect(
      resolveGlobalGraphModelIds({
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-pro',
        globalGraphProviderId: 'deepseek',
        globalGraphModelId: 'deepseek-chat'
      })
    ).toEqual({ providerId: 'gemini', modelId: 'gemini-pro' })
  })

  it('falls back when dialogue is unset or off', () => {
    expect(
      resolveGlobalGraphModelIds({
        globalDialogueProviderId: '',
        globalDialogueModelId: 'off'
      })
    ).toEqual({ providerId: undefined, modelId: 'deepseek-chat' })
  })
})
