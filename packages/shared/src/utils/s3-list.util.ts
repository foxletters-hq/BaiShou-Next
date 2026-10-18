import { buildS3ListUrl } from './s3-url'
import { signS3Request, s3FetchHeaders } from './aws-v4-sign'

export type S3ListedObject = {
  key: string
  lastModified?: string
  size: number
}

export type ParsedS3ListResponse = {
  objects: S3ListedObject[]
  isTruncated: boolean
  nextContinuationToken?: string
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
}

/** 只展开一次预定义实体和合法 XML 字符引用，避免改写文件名中的字面量实体。 */
function decodeXmlText(text: string): string {
  return text.replace(
    /&(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g,
    (reference, entity: string) => {
      if (!entity.startsWith('#')) return XML_ENTITIES[entity] ?? reference
      const codePoint = entity.startsWith('#x')
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10)
      // 无效引用保留原文；不让越界码点或孤立代理项破坏整页列举。
      const isXmlCharacter =
        codePoint === 0x09 ||
        codePoint === 0x0a ||
        codePoint === 0x0d ||
        (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
        (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
        (codePoint >= 0x10000 && codePoint <= 0x10ffff)
      return isXmlCharacter ? String.fromCodePoint(codePoint) : reference
    }
  )
}

/** 解析 ListObjectsV2 XML 单页响应 */
export function parseS3ListObjectsXml(xml: string): ParsedS3ListResponse {
  const objects: S3ListedObject[] = []
  const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g
  let blockMatch: RegExpExecArray | null
  while ((blockMatch = contentsRegex.exec(xml))) {
    const block = blockMatch[1]!
    const keyMatch = block.match(/<Key>([^<]*)<\/Key>/)
    if (!keyMatch?.[1]) continue
    const lmMatch = block.match(/<LastModified>([^<]*)<\/LastModified>/)
    const sizeMatch = block.match(/<Size>(\d+)<\/Size>/)
    objects.push({
      key: decodeXmlText(keyMatch[1]),
      lastModified: lmMatch?.[1],
      size: sizeMatch ? parseInt(sizeMatch[1]!, 10) : 0
    })
  }

  const truncatedMatch = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/)
  const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)

  return {
    objects,
    isTruncated: truncatedMatch?.[1] === 'true',
    nextContinuationToken: tokenMatch?.[1] ? decodeXmlText(tokenMatch[1]) : undefined
  }
}

/** 循环拉取所有分页，直到无 continuation token */
export async function fetchAllS3ListPages(
  fetchXml: (continuationToken?: string) => Promise<string>
): Promise<S3ListedObject[]> {
  const all: S3ListedObject[] = []
  let continuationToken: string | undefined
  do {
    const xml = await fetchXml(continuationToken)
    const page = parseS3ListObjectsXml(xml)
    all.push(...page.objects)
    continuationToken = page.isTruncated ? page.nextContinuationToken : undefined
  } while (continuationToken)
  return all
}

/** 使用 SigV4 分页列出桶内对象（regex 解析 XML，规避 fast-xml-parser 实体展开上限） */
export async function listAllS3Objects(options: {
  endpoint: string
  bucket: string
  prefix: string
  region: string
  accessKey: string
  secretKey: string
  maxKeysPerPage?: number
}): Promise<S3ListedObject[]> {
  return fetchAllS3ListPages(async (continuationToken) => {
    const listUrl = buildS3ListUrl({
      endpoint: options.endpoint,
      bucket: options.bucket,
      prefix: options.prefix,
      continuationToken,
      maxKeys: options.maxKeysPerPage
    })
    const signed = await signS3Request(
      'GET',
      listUrl,
      options.region || 'us-east-1',
      options.accessKey,
      options.secretKey,
      null
    )
    const res = await fetch(listUrl, { method: 'GET', headers: s3FetchHeaders(signed) })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`S3 list failed: ${res.status}${body ? ` ${body.slice(0, 200)}` : ''}`)
    }
    return res.text()
  })
}
