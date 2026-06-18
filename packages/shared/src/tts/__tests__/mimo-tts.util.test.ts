import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildMimoTtsChatCompletionBody,
  getMimoTtsModelMode,
  resolveRefAudioMimeType,
  validateMimoTtsSettings
} from '../mimo-tts.util'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

import { readFile } from 'node:fs/promises'

describe('mimo-tts.util', () => {
  beforeEach(() => {
    vi.mocked(readFile).mockReset()
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
        settings: { voice: '冰糖', responseFormat: 'wav', promptText: '活泼一点' }
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

      expect(body.audio).toEqual({ format: 'wav' })
      expect(body.messages[0]).toEqual({ role: 'user', content: 'young male tone' })
    })

    it('builds voice clone payload with data uri', async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-audio'))

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

      expect(body.audio.voice).toBe(`data:audio/mpeg;base64,${btoa('fake-audio')}`)
      expect(body.messages[0]).toEqual({ role: 'user', content: '' })
    })
  })

  describe('validateMimoTtsSettings', () => {
    it('requires ref audio for voice clone', () => {
      expect(
        validateMimoTtsSettings('mimo-v2.5-tts-voiceclone', { refAudioPath: '', promptText: '' })
      ).toBe('mimo_ref_audio_required')
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
