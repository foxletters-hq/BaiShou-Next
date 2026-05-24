/**
 * 跨平台 AWS Signature V4 签名工具
 *
 * 使用 Web Crypto API（crypto.subtle），兼容 Node.js、浏览器、React Native Hermes。
 * Node.js < 19 通过 node:crypto.webcrypto 回退。
 */

const encoder = new TextEncoder()

/**
 * 获取 crypto.subtle，兼容不同平台
 */
function getSubtle(): SubtleCrypto {
  if (globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle
  }
  // Node.js < 19 fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('node:crypto')
    if (nodeCrypto?.webcrypto?.subtle) {
      return nodeCrypto.webcrypto.subtle
    }
  } catch {}
  throw new Error('Web Crypto API is not available in this environment')
}

/**
 * 将 ArrayBuffer 转换为十六进制字符串
 */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * SHA-256 哈希
 */
async function sha256(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const input = data instanceof Uint8Array ? data : new Uint8Array(data)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getSubtle().digest('SHA-256', input as any)
}

/**
 * HMAC-SHA256
 */
async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoKey = await getSubtle().importKey(
    'raw',
    key as any,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signature = await getSubtle().sign('HMAC', cryptoKey, encoder.encode(data) as any)
  return signature
}

/**
 * 计算 AWS V4 签名密钥
 */
async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(
    encoder.encode(`AWS4${secretKey}`).buffer as ArrayBuffer,
    dateStamp
  )
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  const kSigning = await hmacSha256(kService, 'aws4_request')
  return kSigning
}

/**
 * 对 S3 请求进行 AWS Signature V4 签名
 */
export async function signS3Request(
  method: string,
  url: string,
  region: string,
  accessKey: string,
  secretKey: string,
  body?: ArrayBuffer | null,
  additionalHeaders?: Record<string, string>
): Promise<Record<string, string>> {
  const service = 's3'
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substring(0, 8)

  const parsedUrl = new URL(url)
  const host = parsedUrl.host

  // 计算 payload hash
  const payloadHash = body ? toHex(await sha256(body)) : 'UNSIGNED-PAYLOAD'

  // 构建 headers
  const headers: Record<string, string> = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Host: host,
    ...(additionalHeaders ?? {})
  }

  // 规范化 headers
  const signedHeaders = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .join(';')

  // 构建规范化请求
  const canonicalUri = parsedUrl.pathname || '/'
  const canonicalQuerystring = (parsedUrl.searchParams?.toString() || '')
    .split('&')
    .map((p) => {
      const [key, value] = p.split('=')
      return `${encodeURIComponent(key ?? '')}=${encodeURIComponent(value ?? '')}`
    })
    .sort()
    .join('&')

  const canonicalHeaders =
    Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .map((k) => `${k}:${headers[k]!.trim()}`)
      .join('\n') + '\n'

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')

  // 构建待签名字符串
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const canonicalRequestHash = toHex(await sha256(encoder.encode(canonicalRequest)))

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, canonicalRequestHash].join(
    '\n'
  )

  // 计算签名密钥和最终签名
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service)
  const signature = toHex(await hmacSha256(signingKey, stringToSign))

  // 构建 Authorization 头
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    ...headers,
    Authorization: authorization
  }
}
