import { describe, expect, it, vi, beforeEach } from 'vitest'
import { synthesizeTtsSpeechContent } from '../tts-chunked-synthesis'
import { TtsProviderRegistry } from '../tts.registry'
import type { TtsProvider } from '../../types/tts.types'

describe('synthesizeTtsSpeechContent', () => {
  const registry = new TtsProviderRegistry()

  const provider: TtsProvider = {
    id: 'mock-tts',
    name: 'Mock',
    supportsModel: () => true,
    synthesize: vi.fn(async (request) => ({
      audioBase64: `audio:${request.text}`,
      format: 'mp3'
    }))
  }

  beforeEach(() => {
    registry.register(provider)
    vi.clearAllMocks()
  })

  it('synthesizes each prepared chunk and prefetches next', async () => {
    const segments: string[] = []

    const result = await synthesizeTtsSpeechContent(
      registry,
      {
        globalModels: {
          globalTtsProviderId: 'mock-tts',
          globalTtsModelId: 'tts-1',
          globalTtsSettings: { voice: 'alloy', speed: 1, responseFormat: 'mp3' }
        },
        content: '你好，world. Done!'
      },
      {
        onSegmentReady: async (segment) => {
          segments.push(segment.text)
        },
        useCache: false
      }
    )

    expect(result).toEqual({ success: true, segmentCount: 3 })
    expect(segments).toEqual(['你好，', 'world.', 'Done!'])
    expect(provider.synthesize).toHaveBeenCalledTimes(3)
  })

  it('strips fenced code blocks before synthesis', async () => {
    await synthesizeTtsSpeechContent(
      registry,
      {
        globalModels: {
          globalTtsProviderId: 'mock-tts',
          globalTtsModelId: 'tts-1',
          globalTtsSettings: { voice: 'alloy', speed: 1, responseFormat: 'mp3' }
        },
        content: '说明。```js\nconst x=1\n```结束。'
      },
      { useCache: false }
    )

    expect(provider.synthesize).toHaveBeenCalledTimes(2)
    expect(provider.synthesize).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '说明。' }),
      expect.any(Object)
    )
    expect(provider.synthesize).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '结束。' }),
      expect.any(Object)
    )
  })
})
