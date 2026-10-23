import i18n from 'i18next'
import {
  describeWebDavTarget,
  formatWebDavRequestError,
  isManagedIncrementalZipPath,
  isStrictWebDavChildUrl,
  limitExecute,
  normalizeWebDavListingUrl,
  parseWebDavPropfindEntries,
  resolveWebDavListingUrl,
  rewriteWebDavUrlOrigin,
  suggestWebDavHttpFallbackUrl,
  toRelativeWebDavPath,
  WEBDAV_SHALLOW_LIST_CONCURRENCY
} from '@baishou/shared'
import { isTransientNetworkError } from '../utils/transient-network-error.util'
import type {
  IncrementalCloudOpsHost,
  IncrementalSyncRecord
} from './mobile-incremental-cloud-ops.types'
import { webdavBaseUrl } from './mobile-incremental-cloud-webdav.host'

function resolveWebDavUrl(
  host: IncrementalCloudOpsHost,
  href: string,
  options?: { asCollection?: boolean }
): string {
  return resolveWebDavListingUrl(webdavBaseUrl(host), href, options)
}

async function propfindOnce(
  host: IncrementalCloudOpsHost,
  requestUrl: string,
  depth: '0' | '1'
): Promise<Response> {
  // 与 1.2.13 保持一致：不强制尾斜杠、不强制 PROPFIND body（群晖对这两点更敏感）
  return host.fetchWithAbort(requestUrl, {
    method: 'PROPFIND',
    headers: {
      Authorization: host.webdavAuth(),
      Depth: depth,
      'Content-Type': 'application/xml'
    }
  })
}

async function webdavPropfind(
  host: IncrementalCloudOpsHost,
  url: string,
  depth: '0' | '1'
): Promise<string> {
  // 保留调用方传入的 URL 形态（1.2.13 不对 collection 强行补 `/`）
  const requestUrl = url.replace(/\/+$/, '') || url
  console.warn('[IncrementalSync][WebDAV] propfind', {
    target: describeWebDavTarget(requestUrl),
    depth
  })

  let response: Response
  try {
    response = await propfindOnce(host, requestUrl, depth)
  } catch (e) {
    if (!isTransientNetworkError(e)) throw e

    const fallbackBase = suggestWebDavHttpFallbackUrl(webdavBaseUrl(host))
    if (!fallbackBase || fallbackBase === webdavBaseUrl(host)) {
      console.warn('[IncrementalSync][WebDAV] propfind-network-failed', {
        target: describeWebDavTarget(requestUrl),
        message: e instanceof Error ? e.message : String(e)
      })
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.network_failed',
          'WebDAV 列举失败：无法连接服务器。若使用群晖/NAS，请优先试 http://内网IP:5005；HTTPS 自签证书需在系统中安装并信任，或改用已信任证书。当前目标：{{target}}',
          { target: describeWebDavTarget(requestUrl) }
        )
      )
    }

    const fallbackUrl = rewriteWebDavUrlOrigin(requestUrl, fallbackBase).replace(/\/+$/, '')
    console.warn('[IncrementalSync][WebDAV] propfind-http-fallback', {
      from: describeWebDavTarget(requestUrl),
      to: describeWebDavTarget(fallbackUrl)
    })
    host.adoptWebDavBaseUrl(fallbackBase)

    try {
      response = await propfindOnce(host, fallbackUrl, depth)
    } catch (retryError) {
      console.warn('[IncrementalSync][WebDAV] propfind-fallback-failed', {
        target: describeWebDavTarget(fallbackUrl),
        message: retryError instanceof Error ? retryError.message : String(retryError)
      })
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.network_failed',
          'WebDAV 列举失败：无法连接服务器。若使用群晖/NAS，请优先试 http://内网IP:5005；HTTPS 自签证书需在系统中安装并信任，或改用已信任证书。当前目标：{{target}}',
          { target: describeWebDavTarget(fallbackUrl) }
        )
      )
    }
  }

  if (!response.ok) {
    throw new Error(
      formatWebDavRequestError(
        i18n.t('auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.L82', '列举目录'),
        response.status,
        response.statusText
      )
    )
  }
  return response.text()
}

/**
 * 逐目录 Depth:1 PROPFIND，与桌面端一致；避免 Depth: infinity 在部分网盘/NAS 上 403。
 * visited：同一轮列举内去重，防止父目录回环 / 尾斜杠变体导致请求风暴。
 */
async function collectWebDavShallow(
  host: IncrementalCloudOpsHost,
  remoteUrl: string,
  records: IncrementalSyncRecord[],
  options: {
    missingOk?: boolean
    visited?: Set<string>
  } = { missingOk: true }
): Promise<void> {
  const visited = options.visited ?? new Set<string>()
  const normalizedCurrent = normalizeWebDavListingUrl(remoteUrl)
  if (!normalizedCurrent || visited.has(normalizedCurrent)) return
  visited.add(normalizedCurrent)

  let xml: string
  try {
    xml = await webdavPropfind(host, normalizedCurrent, '1')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('HTTP 404')) {
      if (options.missingOk !== false) return
      throw new Error(
        formatWebDavRequestError(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.L82',
            '列举目录'
          ),
          404,
          i18n.t(
            'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.prefix_missing',
            '路径前缀不存在（请先确认 URL/目录配置可写后再同步）'
          )
        )
      )
    }
    throw e
  }

  const subdirs: string[] = []
  const basePrefix = host.basePath().replace(/\/$/, '')

  for (const entry of parseWebDavPropfindEntries(xml)) {
    const entryUrl = normalizeWebDavListingUrl(resolveWebDavUrl(host, entry.href))

    if (entry.isCollection) {
      // 只递归严格子目录，忽略自身、父目录、兄弟目录
      if (isStrictWebDavChildUrl(normalizedCurrent, entryUrl) && !visited.has(entryUrl)) {
        subdirs.push(entryUrl)
      }
      continue
    }

    const relativeName = toRelativeWebDavPath(entry.href, basePrefix)
    if (!relativeName) continue

    records.push({
      filename: relativeName,
      lastModified: entry.lastModified ?? new Date(0),
      sizeInBytes: entry.sizeInBytes ?? 0,
      managed: isManagedIncrementalZipPath(relativeName)
    })
  }

  await limitExecute(subdirs, WEBDAV_SHALLOW_LIST_CONCURRENCY, async (dirUrl) => {
    await collectWebDavShallow(host, dirUrl, records, {
      missingOk: true,
      visited
    })
  })
}

export async function listWebDav(host: IncrementalCloudOpsHost): Promise<IncrementalSyncRecord[]> {
  // 列举只读：不在此处 MKCOL，避免对只读账号产生写副作用
  const records: IncrementalSyncRecord[] = []
  const baseDir = host.basePath().replace(/\/$/, '')
  const rootUrl = normalizeWebDavListingUrl(
    baseDir ? `${webdavBaseUrl(host)}/${baseDir}` : webdavBaseUrl(host)
  )
  await collectWebDavShallow(host, rootUrl, records, {
    missingOk: false,
    visited: new Set<string>()
  })
  return records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
}
