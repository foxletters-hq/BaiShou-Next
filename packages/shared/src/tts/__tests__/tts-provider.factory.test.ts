import { describe, it, expect, beforeEach } from 'vitest'
import {
  TtsProviderFactory,
  createDefaultTtsRegistry,
  getDefaultTtsRegistry,
  resetDefaultTtsRegistry,
  listRegisteredTtsProviderIds,
  TTS_PROVIDER_IDS
} from '../index'

describe('TtsProviderFactory', () => {
  beforeEach(() => {
    resetDefaultTtsRegistry()
  })

  it('creates built-in providers by id', () => {
    for (const id of TTS_PROVIDER_IDS) {
      const provider = TtsProviderFactory.createProviderForId(id)
      expect(provider?.id).toBe(id)
    }
  })

  it('createDefaultTtsRegistry registers all built-in providers', () => {
    const registry = createDefaultTtsRegistry()
    expect(registry.list()).toHaveLength(TTS_PROVIDER_IDS.length)
    for (const id of TTS_PROVIDER_IDS) {
      expect(registry.get(id)?.id).toBe(id)
    }
  })

  it('getDefaultTtsRegistry returns a lazy singleton', () => {
    const first = getDefaultTtsRegistry()
    const second = getDefaultTtsRegistry()
    expect(first).toBe(second)
  })

  it('resetDefaultTtsRegistry clears the singleton', () => {
    const first = getDefaultTtsRegistry()
    resetDefaultTtsRegistry()
    const second = getDefaultTtsRegistry()
    expect(first).not.toBe(second)
  })

  it('listRegisteredTtsProviderIds matches built-in set', () => {
    expect(listRegisteredTtsProviderIds().sort()).toEqual([...TTS_PROVIDER_IDS].sort())
  })
})
