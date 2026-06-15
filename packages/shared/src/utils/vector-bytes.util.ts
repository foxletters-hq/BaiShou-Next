/** 跨平台 embedding 向量序列化（Node Buffer / React Native 均可用） */
export function embeddingVectorToBytes(vector: number[]): Uint8Array {
  const float32 = new Float32Array(vector)
  return new Uint8Array(float32.buffer, float32.byteOffset, float32.byteLength)
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`
  const len = normalized.length / 2
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function bytesToFloat32Array(bytes: Uint8Array, dimension: number): Float32Array {
  if (bytes.byteLength < dimension * 4) {
    throw new RangeError('embedding bytes shorter than expected dimension')
  }
  return new Float32Array(bytes.buffer, bytes.byteOffset, dimension)
}
