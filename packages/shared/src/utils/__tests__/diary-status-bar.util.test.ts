import { describe, expect, it } from 'vitest'
import { DEFAULT_USER_PROFILE } from '../../constants/user-profile.constants'
import {
  hasGraphModelConfigured,
  isGraphFeatureConfigured,
  isGraphSelfNameConfigured,
  isRagEmbedFeatureConfigured,
  resolveGraphExtractSelfName,
  shouldShowPendingEmbed,
  shouldShowPendingExtract
} from '../diary-status-bar.util'

describe('diary-status-bar.util', () => {
  describe('isGraphSelfNameConfigured', () => {
    it('requires flag true and non-default nickname', () => {
      expect(isGraphSelfNameConfigured(true, 'Alice')).toBe(true)
      expect(isGraphSelfNameConfigured(false, 'Alice')).toBe(false)
      expect(isGraphSelfNameConfigured(true, DEFAULT_USER_PROFILE.nickname)).toBe(false)
      expect(isGraphSelfNameConfigured(true, '  ')).toBe(false)
      expect(isGraphSelfNameConfigured(undefined, 'Alice')).toBe(false)
    })
  })

  describe('visibility helpers', () => {
    it('shows pending extract only when configured and count > 0', () => {
      expect(shouldShowPendingExtract({ graphConfigured: true, count: 3 })).toBe(true)
      expect(shouldShowPendingExtract({ graphConfigured: true, count: 0 })).toBe(false)
      expect(shouldShowPendingExtract({ graphConfigured: false, count: 3 })).toBe(false)
    })

    it('shows pending embed only when configured and count > 0', () => {
      expect(shouldShowPendingEmbed({ ragConfigured: true, count: 2 })).toBe(true)
      expect(shouldShowPendingEmbed({ ragConfigured: true, count: 0 })).toBe(false)
      expect(shouldShowPendingEmbed({ ragConfigured: false, count: 2 })).toBe(false)
    })
  })

  describe('feature configured', () => {
    it('requires self name and graph model', () => {
      expect(
        isGraphFeatureConfigured({ selfNameConfigured: true, hasGraphModel: true })
      ).toBe(true)
      expect(
        isGraphFeatureConfigured({ selfNameConfigured: false, hasGraphModel: true })
      ).toBe(false)
    })

    it('hasGraphModelConfigured requires explicit dialogue provider+model', () => {
      expect(
        hasGraphModelConfigured({
          globalDialogueProviderId: 'openai',
          globalDialogueModelId: 'gpt-4o'
        })
      ).toBe(true)
      expect(hasGraphModelConfigured({})).toBe(false)
      expect(
        hasGraphModelConfigured({
          globalDialogueProviderId: 'openai',
          globalDialogueModelId: 'off'
        })
      ).toBe(false)
    })

    it('isRagEmbedFeatureConfigured requires rag + embedding ids', () => {
      expect(
        isRagEmbedFeatureConfigured({
          ragConfig: { ragEnabled: true },
          globalModels: {
            globalEmbeddingProviderId: 'openai',
            globalEmbeddingModelId: 'text-embedding-3-small'
          }
        })
      ).toBe(true)
      expect(
        isRagEmbedFeatureConfigured({
          ragConfig: { ragEnabled: false },
          globalModels: {
            globalEmbeddingProviderId: 'openai',
            globalEmbeddingModelId: 'text-embedding-3-small'
          }
        })
      ).toBe(false)
      expect(
        isRagEmbedFeatureConfigured({
          ragConfig: { ragEnabled: true },
          globalModels: {
            globalEmbeddingProviderId: '',
            globalEmbeddingModelId: 'text-embedding-3-small'
          }
        })
      ).toBe(false)
    })
  })

  describe('resolveGraphExtractSelfName', () => {
    it('returns trimmed name only when configured', () => {
      expect(resolveGraphExtractSelfName(true, '  Alice  ')).toBe('Alice')
      expect(resolveGraphExtractSelfName(true, DEFAULT_USER_PROFILE.nickname)).toBe(null)
    })
  })
})
