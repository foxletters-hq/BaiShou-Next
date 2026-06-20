import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildMimoTtsChatCompletionBody,
  clearMimoRefAudioHydrationCache,
  hydrateMimoTtsProviderSettings,
  prepareMimoTtsFormSynthesis,
  getMimoTtsModelMode,
  resolveMimoTtsSynthesisModelId,
  resolveRefAudioMimeType,
  validateMimoTtsSettings
} from '../mimo-tts.util'
import { registerTtsRefAudioReader } from '../tts-ref-audio.util'
import { uint8ArrayToBase64 } from '../bytes-base64'

function mockWavBytes(payload?: string): Uint8Array {
  const bytes = new Uint8Array(1200)
  bytes[0] = 0x52
  bytes[1] = 0x49
  bytes[2] = 0x46
  bytes[3] = 0x46
  bytes[8] = 0x57
  bytes[9] = 0x41
  bytes[10] = 0x56
  bytes[11] = 0x45
  if (payload) {
    const encoded = new TextEncoder().encode(payload)
    bytes.set(encoded.slice(0, Math.min(encoded.length, 64)), 128)
  }
  return bytes
}

function mockMp3Buffer(payload = 'clone-sample'): Buffer {
  const content = Buffer.from(payload)
  const buf = Buffer.alloc(Math.max(1200, 128 + content.length))
  buf[0] = 0x49
  buf[1] = 0x44
  buf[2] = 0x33
  content.copy(buf, 128)
  return buf
}

function mockMp3Base64(payload = 'cached-audio'): string {
  return uint8ArrayToBase64(new Uint8Array(mockMp3Buffer(payload)))
}

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

import { readFile } from 'node:fs/promises'

describe('mimo-tts.util', () => {
  beforeEach(() => {
    vi.mocked(readFile).mockReset()
    registerTtsRefAudioReader(null)
    clearMimoRefAudioHydrationCache()
  })

  describe('getMimoTtsModelMode', () => {
    it('detects model modes', () => {
      expect(getMimoTtsModelMode('mimo-v2.5-tts')).toBe('preset')
      expect(getMimoTtsModelMode('mimo-v2.5-tts-voicedesign')).toBe('voicedesign')
      expect(getMimoTtsModelMode('mimo-v2.5-tts-voiceclone')).toBe('voiceclone')
    })
  })

  describe('resolveRefAudioMimeType', () => {
    it('maps wav and mp3 extensions', () => {
      expect(resolveRefAudioMimeType('D:\\audio\\prompt.wav')).toBe('audio/wav')
      expect(resolveRefAudioMimeType('/tmp/sample.mp3')).toBe('audio/mpeg')
    })
  })

  describe('buildMimoTtsChatCompletionBody', () => {
    it('builds preset model payload with voice id', async () => {
      const body = await buildMimoTtsChatCompletionBody({
        modelId: 'mimo-v2.5-tts',
        text: '你好',
        settings: { voice: '冰糖', responseFormat: 'wav', promptText: '活泼一点', stream: false }
      })

      expect(body).toEqual({
        model: 'mimo-v2.5-tts',
        messages: [
          { role: 'user', content: '活泼一点' },
          { role: 'assistant', content: '你好' }
        ],
        audio: { format: 'wav', voice: '冰糖' }
      })
    })

    it('builds voice design payload without voice field', async () => {
      const body = await buildMimoTtsChatCompletionBody({
        modelId: 'mimo-v2.5-tts-voicedesign',
        text: 'Hello',
        settings: { voice: '', responseFormat: 'wav', promptText: 'young male tone' }
      })

      expect(body.audio).toEqual({ format: 'wav', optimize_text_preview: true })
      expect(body.messages[0]).toEqual({ role: 'user', content: 'young male tone' })
    })

    it('upgrades preset model to voiceclone when ref audio is configured', () => {
      expect(resolveMimoTtsSynthesisModelId('mimo-v2.5-tts', 'D:\\audio\\ref.wav')).toBe(
        'mimo-v2.5-tts-voiceclone'
      )
      expect(resolveMimoTtsSynthesisModelId('mimo-v2.5-tts-voiceclone', 'D:\\audio\\ref.wav')).toBe(
        'mimo-v2.5-tts-voiceclone'
      )
      expect(
        resolveMimoTtsSynthesisModelId('mimo-v2.5-tts-voicedesign', 'D:\\audio\\ref.wav')
      ).toBe('mimo-v2.5-tts-voicedesign')
    })

    it('detects voice-clone model id variants', () => {
      expect(getMimoTtsModelMode('mimo-v2.5-tts-voice-clone')).toBe('voiceclone')
    })

    it('builds voice clone payload with data uri', async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from(mockMp3Buffer('fake-audio')))

      const body = await buildMimoTtsChatCompletionBody({
        modelId: 'mimo-v2.5-tts-voiceclone',
        text: 'Yes, I had a sandwich.',
        settings: {
          voice: '',
          responseFormat: 'wav',
          refAudioPath: 'D:\\audio\\voice.mp3',
          promptText: ''
        }
      })

      expect(body.audio.voice).toMatch(/^data:audio\/mpeg;base64,/)
    })

    it('uses voice clone model when preset model id is passed with ref audio', async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from(mockMp3Buffer('clone-sample')))

      const body = await buildMimoTtsChatCompletionBody({
        modelId: 'mimo-v2.5-tts',
        text: '测试复刻',
        settings: {
          voice: '冰糖',
          responseFormat: 'wav',
          refAudioPath: 'D:\\audio\\voice.mp3',
          promptText: ''
        }
      })

      expect(body.model).toBe('mimo-v2.5-tts-voiceclone')
      expect(body.audio.voice).toMatch(/^data:audio\/mpeg;base64,/)
    })

    it('uses sniffed wav mime when wav content has mp3 extension', async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from(mockWavBytes('voice-sample')))

      const body = await buildMimoTtsChatCompletionBody({
        modelId: 'mimo-v2.5-tts-voiceclone',
        text: '测试复刻',
        settings: {
          voice: '',
          responseFormat: 'wav',
          refAudioPath: 'D:\\audio\\ref.mp3',
          promptText: ''
        }
      })

      expect(String(body.audio.voice)).toMatch(/^data:audio\/wav;base64,/)
    })

    it('uses registered ref audio reader before node fs', async () => {
      registerTtsRefAudioReader(async () => mockWavBytes('reader'))

      const body = await buildMimoTtsChatCompletionBody({
        modelId: 'mimo-v2.5-tts-voiceclone',
        text: 'hello',
        settings: {
          voice: '',
          responseFormat: 'wav',
          refAudioPath: '/storage/emulated/0/BaiShou_Root/tts-ref-audio/sample.wav',
          promptText: ''
        }
      })

      expect(readFile).not.toHaveBeenCalled()
      expect(body.audio.voice).toMatch(/^data:audio\/wav;base64,/)
    })
  })

  describe('validateMimoTtsSettings', () => {
    it('requires ref audio for voice clone', () => {
      expect(
        validateMimoTtsSettings('mimo-v2.5-tts-voiceclone', { refAudioPath: '', promptText: '' })
      ).toBe('mimo_ref_audio_required')
      expect(
        validateMimoTtsSettings('mimo-v2.5-tts-voiceclone', {
          refAudioPath: '',
          refAudioBase64: 'ZmFrZQ==',
          promptText: ''
        })
      ).toBeNull()
    })

    it('upgrades to voiceclone when only refAudioBase64 is present', () => {
      expect(resolveMimoTtsSynthesisModelId('mimo-v2.5-tts', undefined, 'ZmFrZQ==')).toBe(
        'mimo-v2.5-tts-voiceclone'
      )
    })

    it('uses persisted refAudioBase64 without reading file when path is empty', async () => {
      const body = await buildMimoTtsChatCompletionBody({
        modelId: 'mimo-v2.5-tts-voiceclone',
        text: 'hello',
        settings: {
          voice: '',
          responseFormat: 'wav',
          refAudioBase64: mockMp3Base64('cached-audio'),
          promptText: ''
        }
      })

      expect(readFile).not.toHaveBeenCalled()
      expect(body.audio.voice).toMatch(/^data:audio\/mpeg;base64,/)
    })

    it('prefers disk ref audio over persisted base64 when path exists', async () => {
      registerTtsRefAudioReader(async () => mockWavBytes('disk-audio'))

      const hydrated = await hydrateMimoTtsProviderSettings(
        {
          voice: '',
          responseFormat: 'wav',
          refAudioPath: '/storage/ref.wav',
          refAudioBase64: mockMp3Base64('stale-cache'),
          promptText: ''
        },
        'mimo-v2.5-tts-voiceclone'
      )

      expect(hydrated.refAudioBase64).toBe(uint8ArrayToBase64(mockWavBytes('disk-audio')))
    })

    it('forces voiceclone model and disables stream for form synthesis', async () => {
      registerTtsRefAudioReader(async () => mockWavBytes('form'))

      const prepared = await prepareMimoTtsFormSynthesis({
        modelId: 'mimo-v2.5-tts',
        voice: '冰糖',
        responseFormat: 'mp3',
        refAudioPath: '/storage/ref.wav',
        promptText: 'Natural, clear and professional speech style.',
        stream: true
      })

      expect(prepared.modelId).toBe('mimo-v2.5-tts-voiceclone')
      expect(prepared.settings.voice).toBe('')
      expect(prepared.settings.stream).toBe(false)
      expect(prepared.settings.responseFormat).toBe('wav')
      expect(prepared.settings.refAudioBase64).toBe(uint8ArrayToBase64(mockWavBytes('form')))
    })

    it('sends wav audio format for voiceclone even when responseFormat is mp3', async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from(mockMp3Buffer('clone-sample')))

      const body = await buildMimoTtsChatCompletionBody({
        modelId: 'mimo-v2.5-tts-voiceclone',
        text: '测试复刻',
        settings: {
          voice: '',
          responseFormat: 'mp3',
          refAudioPath: 'D:\\audio\\ref.mp3',
          promptText: ''
        }
      })

      expect(body.audio.format).toBe('wav')
      expect(body.stream).toBeUndefined()
    })

    it('hydrateMimoTtsProviderSettings reads ref audio when only path is saved', async () => {
      registerTtsRefAudioReader(async () => mockWavBytes('hydrate'))

      const hydrated = await hydrateMimoTtsProviderSettings(
        {
          voice: '冰糖',
          responseFormat: 'wav',
          refAudioPath: '/storage/ref.wav',
          promptText: ''
        },
        'mimo-v2.5-tts-voiceclone'
      )

      expect(hydrated.voice).toBe('')
      expect(hydrated.refAudioBase64).toBe(uint8ArrayToBase64(mockWavBytes('hydrate')))
    })

    it('requires voice design prompt for voicedesign model', () => {
      expect(
        validateMimoTtsSettings('mimo-v2.5-tts-voicedesign', { refAudioPath: '', promptText: '' })
      ).toBe('mimo_voice_design_required')
    })

    it('rejects unsupported voice clone audio formats', () => {
      expect(
        validateMimoTtsSettings('mimo-v2.5-tts-voiceclone', {
          refAudioPath: '"C:\\audio\\sample.m4a"',
          promptText: ''
        })
      ).toBe('mimo_ref_audio_unsupported_format')
    })
  })
})
