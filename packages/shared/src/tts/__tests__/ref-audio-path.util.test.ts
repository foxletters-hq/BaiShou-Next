import { describe, it, expect } from 'vitest'
import {
  normalizeRefAudioPath,
  isMimoVoiceCloneAudioExtension,
  assertMimoVoiceCloneAudioPath
} from '../ref-audio-path.util'
import { TtsApiError } from '../tts.errors'

describe('ref-audio-path.util', () => {
  it('strips wrapping quotes from pasted paths', () => {
    expect(normalizeRefAudioPath('"C:\\Users\\Demo\\Desktop\\sample-audio.m4a"')).toBe(
      'C:\\Users\\Demo\\Desktop\\sample-audio.m4a'
    )
    expect(normalizeRefAudioPath("'D:\\audio\\prompt.wav'")).toBe('D:\\audio\\prompt.wav')
  })

  it('detects supported mimo voice clone extensions', () => {
    expect(isMimoVoiceCloneAudioExtension('D:\\audio\\prompt.wav')).toBe(true)
    expect(isMimoVoiceCloneAudioExtension('D:\\audio\\prompt.mp3')).toBe(true)
    expect(isMimoVoiceCloneAudioExtension('"C:\\audio\\sample.m4a"')).toBe(false)
  })

  it('throws for unsupported extensions', () => {
    expect(() => assertMimoVoiceCloneAudioPath('C:\\audio\\sample.m4a')).toThrow(TtsApiError)
  })
})
