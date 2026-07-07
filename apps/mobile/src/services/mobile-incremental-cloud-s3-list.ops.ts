import { buildS3ListUrl, fetchAllS3ListPages } from '@baishou/shared'
import type {
  IncrementalCloudOpsHost,
  IncrementalSyncRecord
} from './mobile-incremental-cloud-ops.types'

export async function listS3(host: IncrementalCloudOpsHost): Promise<IncrementalSyncRecord[]> {
  const prefix = host.basePath()
  const objects = await fetchAllS3ListPages(async (continuationToken) => {
    const listUrl = buildS3ListUrl({
      endpoint: host.config.endpoint || '',
      bucket: host.config.bucket || '',
      prefix,
      continuationToken
    })
    const response = await host.signAndFetch('GET', listUrl)
    if (!response.ok) throw new Error(`S3 list failed: ${response.status}`)
    return response.text()
  })

  const records: IncrementalSyncRecord[] = []
  for (const obj of objects) {
    if (obj.key.endsWith('/')) continue
    let rel = obj.key
    if (rel.startsWith(prefix)) rel = rel.slice(prefix.length)
    records.push({
      filename: rel,
      lastModified: new Date(obj.lastModified || Date.now()),
      sizeInBytes: obj.size || 0,
      managed: /^BaiShou_.*\.zip$/i.test(rel)
    })
  }
  return records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
}
