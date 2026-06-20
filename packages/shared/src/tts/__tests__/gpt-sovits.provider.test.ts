import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GptSovitsProvider } from '../gpt-sovits.provider'
import { TtsApiError } from '../tts.errors'
import { readFile } from 'node:fs/promises'
import { registerTtsRefAudioReader } from '../tts-ref-audio.util'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

function createResponse(init: {
  ok: boolean
  status?: number
  contentType?: string | null
  arrayBuffer?: ArrayBuffer
  text?: string
  json?: unknown
  body?: ReadableStream<Uint8Array>
}) {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    headers: {
      get: vi.fn().mockReturnValue(init.contentType ?? null)
    },
    body: init.body ?? null,
    arrayBuffer: vi.fn().mockResolvedValue(init.arrayBuffer ?? new ArrayBuffer(0)),
    text: vi.fn().mockResolvedValue(init.text ?? ''),
    json: vi.fn().mockResolvedValue(init.json ?? null)
  } as any
}

function createSseFetchResponse(payloads: Array<Record<string, unknown>>) {
  const encoder = new TextEncoder()
  const sseBody = payloads.map((payload) => `data:${JSON.stringify(payload)}\n\n`).join('')
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sseBody))
      controller.close()
    }
  })
  return createResponse({
    ok: true,
    status: 200,
    contentType: 'text/event-stream',
    body: stream
  })
}

describe('GptSovitsProvider', () => {
  let provider: GptSovitsProvider

  beforeEach(() => {
    provider = new GptSovitsProvider()
    registerTtsRefAudioReader(null)
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

    it('should call api_v2 /tts endpoint with JSON payload', async () => {
      const mockArrayBuffer = new ArrayBuffer(8)
      const bytes = new Uint8Array(mockArrayBuffer)
      let binary = ''
      for (const byte of bytes) {
        binary += String.fromCharCode(byte)
      }
      const expectedBase64 = btoa(binary)
      const mockResponse = createResponse({
        ok: true,
        contentType: 'audio/wav',
        arrayBuffer: mockArrayBuffer
      })
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      const result = await provider.synthesize(mockRequest, mockConfig)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy).toHaveBeenCalledWith('http://127.0.0.1:9880/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String)
      })

      const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
      expect(body.text).toBe('你好，世界')
      expect(body.text_lang).toBe('zh')
      expect(body.ref_audio_path).toBe('D:\\audio\\prompt.wav')
      expect(body.prompt_text).toBe('你好')
      expect(body.prompt_lang).toBe('zh')
      expect(body.speed_factor).toBe(1)
      expect(body.media_type).toBe('wav')
      expect(body.sample_steps).toBe(8)
      expect(body.streaming_mode).toBe(false)

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
        .mockResolvedValueOnce(
          createResponse({ ok: false, status: 404, contentType: 'application/json' })
        )
        .mockResolvedValueOnce(
          createResponse({
            ok: true,
            status: 200,
            contentType: 'audio/wav',
            arrayBuffer: mockArrayBuffer
          })
        )

      const result = await provider.synthesize(mockRequest, mockConfig)

      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        'http://127.0.0.1:9880/tts',
        expect.objectContaining({
          method: 'POST'
        })
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

    it('should fallback to gradio webui when direct api returns non-audio html', async () => {
      const mockArrayBuffer = new ArrayBuffer(8)
      const bytes = new Uint8Array(mockArrayBuffer)
      let binary = ''
      for (const byte of bytes) {
        binary += String.fromCharCode(byte)
      }
      const expectedBase64 = btoa(binary)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('audio'))
      registerTtsRefAudioReader(async () => new Uint8Array([97, 117, 100, 105, 111]))

      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          createResponse({ ok: false, status: 404, contentType: 'application/json' })
        )
        .mockResolvedValueOnce(createResponse({ ok: true, status: 200, contentType: 'text/html' }))
        .mockResolvedValueOnce(
          createResponse({ ok: true, status: 200, contentType: 'application/json' })
        )
        .mockResolvedValueOnce(
          createResponse({
            ok: true,
            status: 200,
            contentType: 'application/json',
            json: ['D:\\upload\\prompt.wav']
          })
        )
        .mockResolvedValueOnce(
          createResponse({
            ok: true,
            status: 200,
            contentType: 'application/json',
            json: { event_id: 'evt-1' }
          })
        )
        .mockResolvedValueOnce(
          createSseFetchResponse([
            {
              msg: 'process_generating',
              event_id: 'evt-1',
              output: {
                data: [{ url: 'http://127.0.0.1:9880/file=audio.wav' }]
              }
            },
            {
              msg: 'process_completed',
              event_id: 'evt-1',
              output: {
                data: [{ url: 'http://127.0.0.1:9880/file=audio.wav' }]
              }
            }
          ])
        )
        .mockResolvedValueOnce(
          createResponse({
            ok: true,
            status: 200,
            contentType: 'audio/wav',
            arrayBuffer: mockArrayBuffer
          })
        )

      const result = await provider.synthesize(mockRequest, mockConfig)

      expect(global.fetch).toHaveBeenNthCalledWith(
        4,
        'http://127.0.0.1:9880/upload',
        expect.objectContaining({ method: 'POST' })
      )
      expect(global.fetch).toHaveBeenNthCalledWith(
        5,
        'http://127.0.0.1:9880/queue/join',
        expect.objectContaining({ method: 'POST' })
      )
      expect(global.fetch).toHaveBeenNthCalledWith(
        6,
        expect.stringMatching(/^http:\/\/127\.0\.0\.1:9880\/queue\/data\?session_hash=/),
        expect.objectContaining({
          headers: { Accept: 'text/event-stream' }
        })
      )
      expect(readFile).not.toHaveBeenCalled()
      expect(result.audioBase64).toBe(expectedBase64)
      expect(result.format).toBe('wav')
    })

    it('should throw TtsApiError when connection to service fails', async () => {
      vi.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))

      const promise = provider.synthesize(mockRequest, mockConfig)

      await expect(promise).rejects.toThrow(TtsApiError)
      await expect(promise).rejects.toThrow('GPT-SoVITS 无法连接到服务: Connection refused')
    })
  })
})
