import { describe, expect, it } from 'vitest'
import {
  resolveGlobalGraphModelIds,
  shouldSyncGraphModelsWithDialogue
} from '../global-graph-model.util'

describe('resolveGlobalGraphModelIds', () => {
  it('prefers configured graph slot', () => {
    expect(
      resolveGlobalGraphModelIds({
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-pro',
        globalGraphProviderId: 'deepseek',
        globalGraphModelId: 'deepseek-chat'
      })
    ).toEqual({ providerId: 'deepseek', modelId: 'deepseek-chat' })
  })

  it('falls back to dialogue when graph unset or off', () => {
    expect(
      resolveGlobalGraphModelIds({
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-pro',
        globalGraphProviderId: '',
        globalGraphModelId: 'off'
      })
    ).toEqual({ providerId: 'gemini', modelId: 'gemini-pro' })
  })
})

describe('shouldSyncGraphModelsWithDialogue', () => {
  it('syncs when graph matches dialogue or is unset', () => {
    expect(
      shouldSyncGraphModelsWithDialogue({
        globalDialogueProviderId: 'a',
        globalDialogueModelId: 'm1',
        globalGraphProviderId: 'a',
        globalGraphModelId: 'm1'
      })
    ).toBe(true)
    expect(
      shouldSyncGraphModelsWithDialogue({
        globalDialogueProviderId: 'a',
        globalDialogueModelId: 'm1',
        globalGraphProviderId: '',
        globalGraphModelId: ''
      })
    ).toBe(true)
  })

  it('does not sync when graph is independently configured', () => {
    expect(
      shouldSyncGraphModelsWithDialogue({
        globalDialogueProviderId: 'a',
        globalDialogueModelId: 'm1',
        globalGraphProviderId: 'b',
        globalGraphModelId: 'm2'
      })
    ).toBe(false)
  })
})
