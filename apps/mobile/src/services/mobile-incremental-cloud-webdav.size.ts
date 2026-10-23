import type { IncrementalCloudOpsHost } from './mobile-incremental-cloud-ops.types'

export async function getWebDavRemoteSize(
  host: IncrementalCloudOpsHost,
  rel: string
): Promise<number> {
  const res = await host.fetchWithAbort(host.webdavFileUrl(rel), {
    method: 'PROPFIND',
    headers: {
      Authorization: host.webdavAuth(),
      Depth: '0',
      'Content-Type': 'application/xml'
    }
  })
  if (!res.ok) return 0
  const xml = await res.text()
  const match = xml.match(/<(?:[^:]*:)?getcontentlength>(\d+)<\/(?:[^:]*:)?getcontentlength>/i)
  return match?.[1] ? parseInt(match[1], 10) : 0
}
