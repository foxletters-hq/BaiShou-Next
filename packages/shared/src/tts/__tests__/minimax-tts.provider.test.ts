import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinimaxTtsProvider } from '../minimax-tts.provider'
import { TtsApiError, TtsInvalidResponseError } from '../tts.errors'

describe('MinimaxTtsProvider', () => {
  let provider: MinimaxTtsProvider

  beforeEach(() => {
    provider = new MinimaxTtsProvider()
    vi.restoreAllMocks()
  })

  it('should return minimax-tts as provider id', () => {
    expect(provider.id).toBe('minimax-tts')
  })

  it('should support speech-* models only', () => {
    expect(provider.supportsModel('speech-2.8-hd')).toBe(true)
    expect(provider.supportsModel('speech-01-turbo')).toBe(true)
    expect(provider.supportsModel('tts-1')).toBe(false)
    expect(provider.supportsModel('mimo-v2.5-tts')).toBe(false)
  })

  describe('synthesize', () => {
    const mockConfig = {
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey: 'test-api-key'
    }

    const mockRequest = {
      text: '你好，世界',
      modelId: 'speech-2.8-hd',
      settings: {
        voice: 'male-qn-qingse',
        speed: 1.0,
        responseFormat: 'mp3'
      }
    }

    it('should call /t2a_v2 endpoint with correct parameters', async () => {
      const audioBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00])
      const hexAudio = Array.from(audioBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const expectedBase64 = btoa(String.fromCharCode(...audioBytes))

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { audio: hexAudio, status: 2 },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      } as any)

      const result = await provider.synthesize(mockRequest, mockConfig)

      expect(fetchSpy).toHaveBeenCalledWith('https://api.minimaxi.com/v1/t2a_v2', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'speech-2.8-hd',
          text: '你好，世界',
          stream: false,
          voice_setting: {
            voice_id: 'male-qn-qingse',
            speed: 1,
            vol: 1,
            pitch: 0
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3',
            channel: 1
          }
        })
      })
      expect(result.audioBase64).toBe(expectedBase64)
      expect(result.format).toBe('mp3')
    })

    it('should use default voice when settings voice is empty', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { audio: 'ff', status: 2 },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      } as any)

      await provider.synthesize(
        {
          ...mockRequest,
          settings: { voice: '', responseFormat: 'mp3' }
        },
        mockConfig
      )

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"voice_id":"male-qn-qingse"')
        })
      )
    })

    it('should throw TtsApiError when HTTP status is not ok', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized')
      } as any)

      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(TtsApiError)
    })

    it('should throw TtsApiError when base_resp status_code is not 0', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          base_resp: { status_code: 1004, status_msg: '鉴权失败' }
        })
      } as any)

      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(TtsApiError)
      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow('鉴权失败')
    })

    it('should call /t2a_v2 endpoint with stream enabled', async () => {
      const audioBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00])
      const hexAudio = Array.from(audioBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({
                  data: { audio: hexAudio, status: 2 },
                  base_resp: { status_code: 0, status_msg: 'success' }
                })}\n`
              )
            )
            controller.close()
          }
        })
      } as any)

      await provider.synthesize(
        {
          ...mockRequest,
          settings: { ...mockRequest.settings, stream: true }
        },
        mockConfig
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"stream":true')
        })
      )
    })

    it('should throw TtsInvalidResponseError when audio is missing', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: null,
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      } as any)

      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(
        TtsInvalidResponseError
      )
    })
  })
})
