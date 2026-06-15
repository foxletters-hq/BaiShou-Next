/** 规范化 S3 endpoint（补全协议、去首尾空格） */
export function normalizeS3Endpoint(endpoint: string): string {
  let safe = (endpoint || '').trim()
  if (!safe) return 'http://localhost'
  if (!safe.startsWith('http://') && !safe.startsWith('https://')) {
    safe = `https://${safe}`
  }
  return safe
}

const IPV4_HOST = /^\d{1,3}(\.\d{1,3}){3}$/

/** 是否使用 path-style 寻址（localhost / 局域网 IP 等） */
export function shouldUseS3PathStyle(endpoint: string): boolean {
  try {
    const host = new URL(normalizeS3Endpoint(endpoint)).hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1') return true
    return IPV4_HOST.test(host)
  } catch {
    return false
  }
}

/** 规范化桶内前缀，保证 trailing slash */
export function normalizeS3BasePath(path?: string): string {
  let p = (path || 'backup_sync').replace(/^\//, '')
  if (p && !p.endsWith('/')) p += '/'
  return p
}

function s3Origin(endpoint: string): { origin: string; uri: URL; usePathStyle: boolean } {
  const uri = new URL(normalizeS3Endpoint(endpoint))
  const port = uri.port ? `:${uri.port}` : ''
  const origin = `${uri.protocol}//${uri.hostname}${port}`
  return { origin, uri, usePathStyle: shouldUseS3PathStyle(endpoint) }
}

/**
 * AWS Sig V4 对象 key 路径段编码。
 * 与 encodeURIComponent 不同：额外编码 !'()*，须与签名 canonical URI 一致。
 */
export function encodeS3ObjectKeySegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

/** 构建 ListObjectsV2 URL */
export function buildS3ListUrl(options: {
  endpoint: string
  bucket: string
  prefix: string
  maxKeys?: number
  continuationToken?: string
}): string {
  const { origin, uri, usePathStyle } = s3Origin(options.endpoint)
  const port = uri.port ? `:${uri.port}` : ''
  const params = new URLSearchParams({ 'list-type': '2', prefix: options.prefix })
  if (options.maxKeys != null) {
    params.set('max-keys', String(options.maxKeys))
  }
  if (options.continuationToken) {
    params.set('continuation-token', options.continuationToken)
  }
  const query = params.toString()

  if (usePathStyle) {
    return `${origin}/${options.bucket}?${query}`
  }
  return `${uri.protocol}//${options.bucket}.${uri.hostname}${port}/?${query}`
}

/** 构建对象 URL（路径段逐段编码） */
export function buildS3ObjectUrl(options: {
  endpoint: string
  bucket: string
  objectKey: string
}): string {
  const { origin, uri, usePathStyle } = s3Origin(options.endpoint)
  const port = uri.port ? `:${uri.port}` : ''
  const encodedKey = options.objectKey
    .split('/')
    .map((seg) => encodeS3ObjectKeySegment(seg))
    .join('/')

  if (usePathStyle) {
    return `${origin}/${options.bucket}/${encodedKey}`
  }
  return `${uri.protocol}//${options.bucket}.${uri.hostname}${port}/${encodedKey}`
}

/** 构建带 query 的对象 URL（multipart initiate / uploadPart / complete 等） */
export function buildS3ObjectUrlWithQuery(options: {
  endpoint: string
  bucket: string
  objectKey: string
  query: Record<string, string>
}): string {
  const url = new URL(
    buildS3ObjectUrl({
      endpoint: options.endpoint,
      bucket: options.bucket,
      objectKey: options.objectKey
    })
  )
  for (const [key, value] of Object.entries(options.query)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}
