import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MimoTtsProvider } from '../mimo-tts.provider'
import { TtsApiError, TtsInvalidResponseError } from '../tts.errors'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

import { readFile } from 'node:fs/promises'

describe('MimoTtsProvider', () => {
  let provider: MimoTtsProvider

  beforeEach(() => {
    provider = new MimoTtsProvider()
    vi.clearAllMocks()
    vi.mocked(readFile).mockReset()
  })

  describe('id', () => {
    it('should return "mimo-tts" as provider id', () => {
      expect(provider.id).toBe('mimo-tts')
    })
  })

  describe('name', () => {
    it('should return display name', () => {
      expect(provider.name).toBe('小米 MiMo TTS')
    })
  })

  describe('supportsModel', () => {
    it('should return true for mimo-v2.5-tts models', () => {
      expect(provider.supportsModel('mimo-v2.5-tts')).toBe(true)
      expect(provider.supportsModel('mimo-v2.5-tts-voiceclone')).toBe(true)
      expect(provider.supportsModel('some-mimo-v2.5-tts-pro')).toBe(true)
    })

    it('should return false for non-mimo models', () => {
      expect(provider.supportsModel('tts-1')).toBe(false)
      expect(provider.supportsModel('gpt-4o-mini-tts')).toBe(false)
    })
  })

  describe('synthesize', () => {
    const mockConfig = {
      baseUrl: 'https://api.mimo.com/v1',
      apiKey: 'test-api-key'
    }

    const mockRequest = {
      text: '你好世界',
      modelId: 'mimo-v2.5-tts',
      settings: {
        voice: '冰糖',
        responseFormat: 'wav'
      }
    }

    it('should call /chat/completions endpoint with correct parameters', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                audio: {
                  data: 'base64audiodata'
                }
              }
            }
          ]
        })
      }
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      const result = await provider.synthesize(mockRequest, mockConfig)

      expect(fetchSpy).toHaveBeenCalledWith('https://api.mimo.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mimo-v2.5-tts',
          messages: [
            {
              role: 'user',
              content: 'Natural, clear and professional speech style.'
            },
            { role: 'assistant', content: '你好世界' }
          ],
          audio: {
            format: 'wav',
            voice: '冰糖'
          }
        })
      })
      expect(result.audioBase64).toBe('base64audiodata')
      expect(result.format).toBe('wav')
    })

    it('should send voice clone data uri for voiceclone model', async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from('clone-sample'))

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { audio: { data: 'cloned-audio' } } }]
        })
      }
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      await provider.synthesize(
        {
          text: '测试复刻',
          modelId: 'mimo-v2.5-tts-voiceclone',
          settings: {
            voice: '',
            responseFormat: 'wav',
            refAudioPath: 'D:\\audio\\ref.mp3'
          }
        },
        mockConfig
      )

      const requestBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
      expect(requestBody.model).toBe('mimo-v2.5-tts-voiceclone')
      expect(requestBody.audio.voice).toBe(`data:audio/mpeg;base64,${btoa('clone-sample')}`)
      expect(requestBody.messages).toEqual([
        { role: 'user', content: '' },
        { role: 'assistant', content: '测试复刻' }
      ])
    })

    it('should use default values when settings are missing', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { audio: { data: 'test' } } }]
        })
      }
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      await provider.synthesize(
        {
          ...mockRequest,
          settings: { voice: '', responseFormat: '' }
        },
        mockConfig
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            model: 'mimo-v2.5-tts',
            messages: [
              {
                role: 'user',
                content: 'Natural, clear and professional speech style.'
              },
              { role: 'assistant', content: '你好世界' }
            ],
            audio: {
              format: 'wav',
              voice: '冰糖'
            }
          })
        })
      )
    })

    it('should throw TtsApiError when voice clone ref audio is missing', async () => {
      await expect(
        provider.synthesize(
          {
            text: '测试',
            modelId: 'mimo-v2.5-tts-voiceclone',
            settings: { voice: '', responseFormat: 'wav', refAudioPath: '' }
          },
          mockConfig
        )
      ).rejects.toThrow(TtsApiError)
    })

    it('should throw TtsApiError when API returns error status', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad request')
      }
      vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(TtsApiError)
    })

    it('should throw TtsInvalidResponseError when no audio data in response', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: {} }]
        })
      }
      vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(
        TtsInvalidResponseError
      )
    })
  })
})
