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
      key: keyMatch[1],
      lastModified: lmMatch?.[1],
      size: sizeMatch ? parseInt(sizeMatch[1]!, 10) : 0
    })
  }

  const truncatedMatch = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/)
  const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)

  return {
    objects,
    isTruncated: truncatedMatch?.[1] === 'true',
    nextContinuationToken: tokenMatch?.[1]
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
