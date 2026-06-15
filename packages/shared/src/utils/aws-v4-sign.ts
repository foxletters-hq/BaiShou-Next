/**
 * 跨平台 AWS Signature V4 签名工具
 *
 * 优先使用 Web Crypto API（crypto.subtle）；不可用时回退到纯 JS SHA-256/HMAC（React Native Hermes）。
 * Node.js < 19 通过 node:crypto.webcrypto 回退。
 */

import { encodeS3ObjectKeySegment } from './s3-url'
import { hmacSha256Pure, sha256Pure } from './sha256-pure'

const encoder = new TextEncoder()

function getSubtle(): SubtleCrypto | null {
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
  return null
}

const subtleCrypto = getSubtle()

/** AWS Sig V4 规范化 query string（对已解码的 searchParams 逐项编码，避免双重编码） */
function canonicalQueryString(searchParams: URLSearchParams): string {
  const entries: [string, string][] = []
  searchParams.forEach((value, key) => {
    entries.push([key, value])
  })
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${awsUriEncode(key)}=${awsUriEncode(value)}`)
    .join('&')
}

/** @deprecated 使用 encodeS3ObjectKeySegment */
const awsUriEncode = encodeS3ObjectKeySegment

function canonicalUri(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return ''
      let decoded = segment
      try {
        decoded = decodeURIComponent(segment)
      } catch {
        // 保留原 segment（畸形 % 编码）
      }
      return awsUriEncode(decoded)
    })
    .join('/')
}

/**
 * 转为 fetch / uploadAsync 可用的请求头。
 * Host 仅参与签名，由 HTTP 客户端根据 URL 自动设置，避免 RN 手动设置 Host 导致验签失败。
 */
export function s3FetchHeaders(signed: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(signed)) {
    if (key.toLowerCase() === 'host') continue
    headers[key] = value
  }
  return headers
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
  if (subtleCrypto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return subtleCrypto.digest('SHA-256', input as any)
  }
  return sha256Pure(input).buffer as ArrayBuffer
}

/**
 * HMAC-SHA256
 */
async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const keyBytes = key instanceof Uint8Array ? key : new Uint8Array(key)
  if (subtleCrypto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cryptoKey = await subtleCrypto.importKey(
      'raw',
      keyBytes as any,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return subtleCrypto.sign('HMAC', cryptoKey, encoder.encode(data) as any)
  }
  return hmacSha256Pure(keyBytes, encoder.encode(data)).buffer as ArrayBuffer
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
  const kDate = await hmacSha256(encoder.encode(`AWS4${secretKey}`), dateStamp)
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
  const trimmedAccessKey = accessKey.trim()
  const trimmedSecretKey = secretKey.trim()
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
  const canonicalUriValue = canonicalUri(parsedUrl.pathname || '/')
  const canonicalQuerystring = canonicalQueryString(parsedUrl.searchParams)

  const canonicalHeaders =
    Object.entries(headers)
      .map(([key, value]) => [key.toLowerCase(), value.trim()] as const)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('\n') + '\n'

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUriValue,
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
  const signingKey = await getSignatureKey(trimmedSecretKey, dateStamp, region, service)
  const signature = toHex(await hmacSha256(signingKey, stringToSign))

  const authorization = `AWS4-HMAC-SHA256 Credential=${trimmedAccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    ...headers,
    Authorization: authorization
  }
}
