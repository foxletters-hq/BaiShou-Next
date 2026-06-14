import { describe, expect, it } from 'vitest'
import { hmacSha256Pure, sha256Pure } from '../sha256-pure'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('sha256Pure', () => {
  it('hashes empty input', () => {
    expect(toHex(sha256Pure(new Uint8Array()))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  })

  it('hashes abc', () => {
    const data = new TextEncoder().encode('abc')
    expect(toHex(sha256Pure(data))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })
})

describe('hmacSha256Pure', () => {
  it('matches RFC 4231 test case 1', () => {
    const key = new Uint8Array(20).fill(0x0b)
    const data = new TextEncoder().encode('Hi There')
    expect(toHex(hmacSha256Pure(key, data))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'
    )
  })
})
