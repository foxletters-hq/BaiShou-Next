import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAiTtsProvider } from '../openai-tts.provider'
import { TtsApiError } from '../tts.errors'

describe('OpenAiTtsProvider', () => {
  let provider: OpenAiTtsProvider

  beforeEach(() => {
    provider = new OpenAiTtsProvider()
    vi.restoreAllMocks()
  })

  describe('id', () => {
    it('should return "openai-tts" as provider id', () => {
      expect(provider.id).toBe('openai-tts')
    })
  })

  describe('name', () => {
    it('should return display name', () => {
      expect(provider.name).toBe('OpenAI 兼容 TTS')
    })
  })

  describe('supportsModel', () => {
    it('should return true for models not matching mimo pattern', () => {
      expect(provider.supportsModel('tts-1')).toBe(true)
      expect(provider.supportsModel('gpt-4o-mini-tts')).toBe(true)
      expect(provider.supportsModel('any-model')).toBe(true)
    })

    it('should return false for mimo-v2.5-tts models', () => {
      expect(provider.supportsModel('mimo-v2.5-tts')).toBe(false)
      expect(provider.supportsModel('some-mimo-v2.5-tts-pro')).toBe(false)
    })
  })

  describe('synthesize', () => {
    const mockConfig = {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-api-key'
    }

    const mockRequest = {
      text: 'Hello world',
      modelId: 'tts-1',
      settings: {
        voice: 'alloy',
        speed: 1.0,
        responseFormat: 'mp3'
      }
    }

    it('should call /audio/speech endpoint with correct parameters', async () => {
      const mockArrayBuffer = new ArrayBuffer(8)
      const bytes = new Uint8Array(mockArrayBuffer)
      let binary = ''
      for (const byte of bytes) {
        binary += String.fromCharCode(byte)
      }
      const expectedBase64 = btoa(binary)
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer)
      }
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      const result = await provider.synthesize(mockRequest, mockConfig)

      expect(fetchSpy).toHaveBeenCalledWith('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: 'Hello world',
          voice: 'alloy',
          speed: 1.0,
          response_format: 'mp3'
        })
      })
      expect(result.audioBase64).toBe(expectedBase64)
      expect(result.format).toBe('mp3')
    })

    it('should use default values when settings are missing', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
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
            model: 'tts-1',
            input: 'Hello world',
            voice: 'alloy',
            speed: 1.0,
            response_format: 'mp3'
          })
        })
      )
    })

    it('should strip trailing slash from baseUrl', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
      }
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      await provider.synthesize(mockRequest, {
        ...mockConfig,
        baseUrl: 'https://api.example.com/v1/'
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/v1/audio/speech',
        expect.any(Object)
      )
    })

    it('should throw TtsApiError when API returns error status', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized')
      }
      vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(TtsApiError)
      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow('TTS API 调用失败')
    })

    it('should include status code in TtsApiError', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Server error')
      }
      vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      try {
        await provider.synthesize(mockRequest, mockConfig)
      } catch (error) {
        expect(error).toBeInstanceOf(TtsApiError)
        expect((error as TtsApiError).statusCode).toBe(500)
      }
    })
  })
})
