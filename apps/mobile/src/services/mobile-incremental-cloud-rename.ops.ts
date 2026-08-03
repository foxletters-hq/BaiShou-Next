import { buildS3ObjectUrl, buildWebDavFileUrl } from '@baishou/shared'
import type { IncrementalCloudOpsHost } from './mobile-incremental-cloud-ops.types'

/** S3 重命名：服务端 CopyObject + Delete（字节不出端） */
export async function renameS3(
  host: IncrementalCloudOpsHost,
  oldRel: string,
  newRel: string
): Promise<void> {
  const bucket = host.config.bucket || ''
  const oldKey = host.basePath() + oldRel
  const newKey = host.basePath() + newRel
  const copyUrl = buildS3ObjectUrl({
    endpoint: host.config.endpoint || '',
    bucket,
    objectKey: newKey
  })
  const copyRes = await host.signAndFetch('PUT', copyUrl, {
    'x-amz-copy-source': `/${bucket}/${oldKey}`
  })
  if (!copyRes.ok) {
    throw new Error(`S3 copy failed: ${copyRes.status}`)
  }

  const deleteUrl = buildS3ObjectUrl({
    endpoint: host.config.endpoint || '',
    bucket,
    objectKey: oldKey
  })
  const deleteRes = await host.signAndFetch('DELETE', deleteUrl)
  if (!deleteRes.ok && deleteRes.status !== 404) {
    throw new Error(`S3 delete after copy failed: ${deleteRes.status}`)
  }
}

/** WebDAV 重命名：HTTP MOVE（可整目录一次搬完） */
export async function renameWebDav(
  host: IncrementalCloudOpsHost,
  oldRel: string,
  newRel: string
): Promise<void> {
  const auth = host.webdavAuth()
  const sourceUrl = host.webdavFileUrl(oldRel)
  const destUrl = buildWebDavFileUrl(host.webdavConfiguredBaseUrl(), host.basePath(), newRel)

  // 确保目标父目录存在（逐文件 MOVE 时需要）
  const parentSegments = newRel.split('/').filter(Boolean).slice(0, -1)
  if (parentSegments.length > 0) {
    await ensureWebDavParentDirs(host, parentSegments)
  }

  const res = await host.fetchWithAbort(sourceUrl, {
    method: 'MOVE',
    headers: {
      Authorization: auth,
      Destination: destUrl,
      Overwrite: 'T'
    }
  })
  if (!res.ok) {
    throw new Error(`WebDAV MOVE failed: ${res.status}`)
  }
}

async function ensureWebDavParentDirs(
  host: IncrementalCloudOpsHost,
  segments: string[]
): Promise<void> {
  const auth = host.webdavAuth()
  let pathSoFar = ''
  for (const part of segments) {
    pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part
    const dirUrl = host.webdavFileUrl(pathSoFar)
    const res = await host.fetchWithAbort(dirUrl, {
      method: 'MKCOL',
      headers: { Authorization: auth }
    })
    // 201 created / 405 already exists / 409 conflict — 均视为可继续
    if (!res.ok && res.status !== 405 && res.status !== 409 && res.status !== 301) {
      // 部分网盘对已存在目录返回 200；其它错误不阻断 MOVE（MOVE 自己会再报）
      if (res.status >= 500) {
        throw new Error(`WebDAV MKCOL failed: ${res.status}`)
      }
    }
  }
}
