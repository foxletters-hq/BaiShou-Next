/** Vitest stub：避免 expo-crypto → expo-modules-core 依赖真 RN 运行时 */
export async function digestStringAsync(
  _algorithm: string,
  data: string,
  _options?: { encoding?: string }
): Promise<string> {
  // 测试用确定性伪哈希，足够覆盖依赖该 API 的路径
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31 + data.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
  SHA1: 'SHA-1',
  MD5: 'MD5'
}

export default {
  digestStringAsync,
  CryptoDigestAlgorithm
}
