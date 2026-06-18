import { describe, expect, it } from 'vitest'
import { base64ToUint8Array, uint8ArrayToBase64 } from '../bytes-base64'

describe('bytes-base64', () => {
  it('round-trips bytes through base64', () => {
    const input = new Uint8Array([0, 127, 255, 1, 2, 3, 65, 66, 67])
    const encoded = uint8ArrayToBase64(input)
    const decoded = base64ToUint8Array(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(input))
  })

  it('matches btoa for small payloads', () => {
    const text = 'hello-tts-audio'
    const bytes = new TextEncoder().encode(text)
    const expected = btoa(String.fromCharCode(...bytes))
    expect(uint8ArrayToBase64(bytes)).toBe(expected)
  })
})
