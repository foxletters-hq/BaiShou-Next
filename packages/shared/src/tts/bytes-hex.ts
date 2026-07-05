/** 将 hex 编码字符串解码为 Uint8Array。 */
export function hexToUint8Array(hex: string): Uint8Array {
  const trimmed = hex.trim()
  if (!trimmed) return new Uint8Array(0)

  const bytes = new Uint8Array(trimmed.length / 2)
  for (let i = 0; i < trimmed.length; i += 2) {
    bytes[i / 2] = Number.parseInt(trimmed.slice(i, i + 2), 16)
  }
  return bytes
}
