import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GptSovitsProvider } from '../gpt-sovits.provider'
import { TtsApiError } from '../tts.errors'

describe('GptSovitsProvider', () => {
  let provider: GptSovitsProvider

  beforeEach(() => {
    provider = new GptSovitsProvider()
    vi.restoreAllMocks()
  })

  describe('id', () => {
    it('should return "gpt-sovits" as provider id', () => {
      expect(provider.id).toBe('gpt-sovits')
    })
  })

  describe('name', () => {
    it('should return display name', () => {
      expect(provider.name).toBe('GPT-SoVITS 本地服务')
    })
  })

  describe('supportsModel', () => {
    it('should return true for any model ID', () => {
      expect(provider.supportsModel('default')).toBe(true)
      expect(provider.supportsModel('some-model')).toBe(true)
    })
  })

  describe('synthesize', () => {
    const mockConfig = {
      baseUrl: 'http://127.0.0.1:9880',
      apiKey: ''
    }

    const mockRequest = {
      text: '你好，世界',
      modelId: 'default',
      settings: {
        voice: 'default',
        speed: 1.0,
        responseFormat: 'wav',
        refAudioPath: 'D:\\audio\\prompt.wav',
        promptText: '你好',
        promptLang: 'zh',
        textLang: 'zh'
      }
    }

    it('should call /tts endpoint with correct URL parameters', async () => {
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

      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('http://127.0.0.1:9880/tts?'), {
        method: 'GET'
      })

      const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
      const parsedUrl = new URL(calledUrl)
      expect(parsedUrl.origin).toBe('http://127.0.0.1:9880')
      expect(parsedUrl.pathname).toBe('/tts')
      expect(parsedUrl.searchParams.get('text')).toBe('你好，世界')
      expect(parsedUrl.searchParams.get('text_lang')).toBe('zh')
      expect(parsedUrl.searchParams.get('ref_audio_path')).toBe('D:\\audio\\prompt.wav')
      expect(parsedUrl.searchParams.get('prompt_text')).toBe('你好')
      expect(parsedUrl.searchParams.get('prompt_lang')).toBe('zh')
      expect(parsedUrl.searchParams.get('speed_factor')).toBe('1')
      expect(parsedUrl.searchParams.get('media_type')).toBe('wav')

      expect(result.audioBase64).toBe(expectedBase64)
      expect(result.format).toBe('wav')
    })

    it('should throw TtsApiError when refAudioPath is missing', async () => {
      const invalidRequest = {
        ...mockRequest,
        settings: {
          ...mockRequest.settings,
          refAudioPath: ''
        }
      }

      await expect(provider.synthesize(invalidRequest, mockConfig)).rejects.toThrow(TtsApiError)
      await expect(provider.synthesize(invalidRequest, mockConfig)).rejects.toThrow(
        'GPT-SoVITS 需要指定参考音频路径 (refAudioPath)'
      )
    })

    it('should throw TtsApiError when API returns error status', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Invalid path')
      }
      vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(TtsApiError)
      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(
        'GPT-SoVITS API 合成失败: Invalid path'
      )
    })

    it('should fallback to root endpoint with v1 parameters when /tts returns 404', async () => {
      const mockArrayBuffer = new ArrayBuffer(8)
      const bytes = new Uint8Array(mockArrayBuffer)
      let binary = ''
      for (const byte of bytes) {
        binary += String.fromCharCode(byte)
      }
      const expectedBase64 = btoa(binary)

      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          status: 404,
          ok: false
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer)
        } as any)

      const result = await provider.synthesize(mockRequest, mockConfig)

      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('http://127.0.0.1:9880/tts?'),
        { method: 'GET' }
      )

      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('http://127.0.0.1:9880/?'),
        { method: 'GET' }
      )

      const calledUrl = fetchSpy.mock.calls[1]?.[0] as string
      const parsedUrl = new URL(calledUrl)
      expect(parsedUrl.origin).toBe('http://127.0.0.1:9880')
      expect(parsedUrl.pathname).toBe('/')
      expect(parsedUrl.searchParams.get('text')).toBe('你好，世界')
      expect(parsedUrl.searchParams.get('text_language')).toBe('zh')
      expect(parsedUrl.searchParams.get('refer_wav_path')).toBe('D:\\audio\\prompt.wav')
      expect(parsedUrl.searchParams.get('prompt_text')).toBe('你好')
      expect(parsedUrl.searchParams.get('prompt_language')).toBe('zh')
      expect(parsedUrl.searchParams.get('speed')).toBe('1')

      expect(result.audioBase64).toBe(expectedBase64)
      expect(result.format).toBe('wav')
    })

    it('should throw TtsApiError when fallback request also fails', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          status: 404,
          ok: false
        } as any)
        .mockResolvedValueOnce({
          status: 400,
          ok: false,
          text: vi.fn().mockResolvedValue('Missing parameters')
        } as any)

      let error: any
      try {
        await provider.synthesize(mockRequest, mockConfig)
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(TtsApiError)
      expect(error.message).toContain('GPT-SoVITS API 合成失败: Missing parameters')
    })

    it('should throw TtsApiError when connection to service fails', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection refused'))

      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(TtsApiError)
      await expect(provider.synthesize(mockRequest, mockConfig)).rejects.toThrow(
        'GPT-SoVITS 无法连接到服务: Connection refused'
      )
    })
  })
})
