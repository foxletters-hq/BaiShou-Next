import { describe, expect, it } from 'vitest'
import { bytesToFloat32Array, embeddingVectorToBytes, hexToBytes } from '../vector-bytes.util'

describe('vector-bytes.util', () => {
  it('round-trips float32 vectors through bytes', () => {
    const vector = [0.1, 0.2, 0.3]
    const bytes = embeddingVectorToBytes(vector)
    const restored = Array.from(bytesToFloat32Array(bytes, vector.length))
    expect(restored[0]).toBeCloseTo(0.1)
    expect(restored[1]).toBeCloseTo(0.2)
    expect(restored[2]).toBeCloseTo(0.3)
  })

  it('decodes hex embedding blobs', () => {
    const bytes = embeddingVectorToBytes([1, 2])
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const decoded = hexToBytes(hex)
    expect(Array.from(decoded)).toEqual(Array.from(bytes))
  })
})
