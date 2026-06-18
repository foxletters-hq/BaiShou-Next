const BASE64_CHUNK_SIZE = 0x8000

/** 高效地将二进制转为 base64，避免逐字节字符串拼接导致 O(n²)。 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/** 将 base64 解码为 Uint8Array。 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64) return new Uint8Array(0)

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
