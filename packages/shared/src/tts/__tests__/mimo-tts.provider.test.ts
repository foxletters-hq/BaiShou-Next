import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MimoTtsProvider } from '../mimo-tts.provider'
import { TtsApiError, TtsInvalidResponseError } from '../tts.errors'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

import { readFile } from 'node:fs/promises'

function mockMp3Buffer(payload = 'clone-sample'): Buffer {
  const content = Buffer.from(payload)
  const buf = Buffer.alloc(Math.max(1200, 128 + content.length))
  buf[0] = 0x49
  buf[1] = 0x44
  buf[2] = 0x33
  content.copy(buf, 128)
  return buf
}

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

      const result = await provider.synthesize(
        {
          ...mockRequest,
          settings: { ...mockRequest.settings, stream: false }
        },
        mockConfig
      )

      expect(fetchSpy).toHaveBeenCalledWith('https://api.mimo.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'api-key': 'test-api-key',
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

    it('should use streaming pcm16 when stream is explicitly enabled', async () => {
      const sse = [
        `data: ${JSON.stringify({
          choices: [{ delta: { audio: { data: btoa(String.fromCharCode(0, 1, 2, 3)) } } }]
        })}`,
        '',
        'data: [DONE]',
        ''
      ].join('\n')

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(sse))
              controller.close()
            }
          })
        ) as any
      )

      const result = await provider.synthesize(
        {
          ...mockRequest,
          settings: { ...mockRequest.settings, stream: true }
        },
        mockConfig
      )

      const requestBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
      expect(requestBody.stream).toBe(true)
      expect(requestBody.audio.format).toBe('pcm16')
      expect(result.format).toBe('wav')
      expect(result.audioBase64.length).toBeGreaterThan(0)
    })

    it('should not stream voiceclone by default', async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from(mockMp3Buffer('clone-sample')))

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
      expect(requestBody.audio.voice).toMatch(/^data:audio\/mpeg;base64,/)
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
          settings: { voice: '', responseFormat: '', stream: false }
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

      await expect(
        provider.synthesize(
          { ...mockRequest, settings: { ...mockRequest.settings, stream: false } },
          mockConfig
        )
      ).rejects.toThrow(TtsInvalidResponseError)
    })
  })
})
