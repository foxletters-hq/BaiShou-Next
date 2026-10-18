import { describe, expect, it } from 'vitest'
import { resolveMobileDiaryEmbedListSource } from '../mobile-rag-vault-diary'

describe('resolveMobileDiaryEmbedListSource', () => {
  it('should use the live diary store for the active vault even when a shadow index exists', () => {
    expect(resolveMobileDiaryEmbedListSource({ isActiveVault: true, hasShadowDb: true })).toBe(
      'live'
    )
  })

  it('should use the shadow index for other vaults when it is connected', () => {
    expect(resolveMobileDiaryEmbedListSource({ isActiveVault: false, hasShadowDb: true })).toBe(
      'shadow'
    )
  })

  it('should skip other vaults when no shadow index is connected', () => {
    expect(resolveMobileDiaryEmbedListSource({ isActiveVault: false, hasShadowDb: false })).toBe(
      'none'
    )
  })
})
