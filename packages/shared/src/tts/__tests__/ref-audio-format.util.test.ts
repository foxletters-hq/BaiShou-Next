import { describe, it, expect } from 'vitest'
import {
  sniffRefAudioFormat,
  resolveRefAudioMimeFromBytes,
  describeRefAudioBytes,
  assertSupportedRefAudioBytes
} from '../ref-audio-format.util'
import { TtsApiError } from '../tts.errors'

function wavBytes(): Uint8Array {
  const bytes = new Uint8Array(1200)
  bytes[0] = 0x52
  bytes[1] = 0x49
  bytes[2] = 0x46
  bytes[3] = 0x46
  bytes[8] = 0x57
  bytes[9] = 0x41
  bytes[10] = 0x56
  bytes[11] = 0x45
  return bytes
}

function mp3Bytes(): Uint8Array {
  const bytes = new Uint8Array(1200)
  bytes[0] = 0x49
  bytes[1] = 0x44
  bytes[2] = 0x33
  return bytes
}

describe('ref-audio-format.util', () => {
  it('sniffs wav and mp3 magic bytes', () => {
    expect(sniffRefAudioFormat(wavBytes())).toBe('wav')
    expect(sniffRefAudioFormat(mp3Bytes())).toBe('mp3')
    expect(sniffRefAudioFormat(new Uint8Array([0, 1, 2, 3]))).toBe('unknown')
  })

  it('prefers sniffed mime over path extension', () => {
    expect(resolveRefAudioMimeFromBytes(wavBytes(), 'sample.mp3')).toBe('audio/wav')
    expect(resolveRefAudioMimeFromBytes(mp3Bytes(), 'sample.wav')).toBe('audio/mpeg')
  })

  it('reports mime mismatch between path and content', () => {
    const info = describeRefAudioBytes(wavBytes(), 'sample.mp3')
    expect(info.sniffedFormat).toBe('wav')
    expect(info.sniffedMime).toBe('audio/wav')
    expect(info.pathMime).toBe('audio/mpeg')
    expect(info.mimeMismatch).toBe(true)
  })

  it('rejects unknown or too-short audio', () => {
    expect(() => assertSupportedRefAudioBytes(new Uint8Array([1, 2, 3]))).toThrow(TtsApiError)
    expect(() => assertSupportedRefAudioBytes(new Uint8Array(512))).toThrow(TtsApiError)
    expect(assertSupportedRefAudioBytes(wavBytes())).toBe('wav')
  })
})
