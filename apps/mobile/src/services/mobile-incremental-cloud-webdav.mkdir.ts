import i18n from 'i18next'
import { formatWebDavRequestError, isTransientWebDavHttpStatus } from '@baishou/shared'
import type { IncrementalCloudOpsHost } from './mobile-incremental-cloud-ops.types'
import { webdavBaseUrl } from './mobile-incremental-cloud-webdav.host'

/** 同一 host 上已确保存在的目录，避免并发上传重复 MKCOL 触发网盘 503 */
const ensuredWebDavDirsByHost = new WeakMap<object, Set<string>>()
const pendingWebDavMkcolByHost = new WeakMap<object, Map<string, Promise<void>>>()

const MKCOL_OK = new Set([200, 201, 204, 405, 409])
const MKCOL_MAX_ATTEMPTS = 4

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function mkcolOnce(
  host: IncrementalCloudOpsHost,
  dirUrl: string,
  auth: string
): Promise<number> {
  const res = await host.fetchWithAbort(dirUrl, {
    method: 'MKCOL',
    headers: { Authorization: auth }
  })
  return res.status
}

/**
 * 逐级 MKCOL；对 429/5xx 退避重试，并合并同一路径的并发请求。
 */
export async function ensureWebDavPathSegments(
  host: IncrementalCloudOpsHost,
  segments: string[]
): Promise<void> {
  if (segments.length === 0) return

  const baseUrl = webdavBaseUrl(host)
  const auth = host.webdavAuth()
  let ensured = ensuredWebDavDirsByHost.get(host)
  if (!ensured) {
    ensured = new Set()
    ensuredWebDavDirsByHost.set(host, ensured)
  }
  let pending = pendingWebDavMkcolByHost.get(host)
  if (!pending) {
    pending = new Map()
    pendingWebDavMkcolByHost.set(host, pending)
  }

  let current = ''
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment
    if (ensured.has(current)) continue

    const inflight = pending.get(current)
    if (inflight) {
      await inflight
      continue
    }

    const pathForError = current
    const run = (async () => {
      const dirUrl = `${baseUrl}/${pathForError}`
      let lastStatus = 0
      for (let attempt = 0; attempt < MKCOL_MAX_ATTEMPTS; attempt++) {
        lastStatus = await mkcolOnce(host, dirUrl, auth)
        if (MKCOL_OK.has(lastStatus)) {
          ensured!.add(pathForError)
          return
        }
        if (!isTransientWebDavHttpStatus(lastStatus) || attempt >= MKCOL_MAX_ATTEMPTS - 1) {
          break
        }
        await sleepMs(400 * 2 ** attempt)
      }
      throw new Error(
        formatWebDavRequestError(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.incremental.cloud.webdav.ops.L110',
            '创建目录 {{path}}',
            { path: pathForError }
          ),
          lastStatus
        )
      )
    })()

    pending.set(current, run)
    try {
      await run
    } finally {
      pending.delete(current)
    }
  }
}

export async function ensureWebDavBasePath(host: IncrementalCloudOpsHost): Promise<void> {
  const prefix = host.basePath().replace(/\/$/, '')
  if (!prefix) return
  const segments = prefix.split('/').filter(Boolean)
  await ensureWebDavPathSegments(host, segments)
}

export async function ensureWebDavDirs(host: IncrementalCloudOpsHost, rel: string): Promise<void> {
  const remoteFilePath = (host.basePath() + rel).replace(/^\//, '')
  const parentPath = remoteFilePath.replace(/\/[^/]+$/, '')
  if (!parentPath) return
  await ensureWebDavPathSegments(host, parentPath.split('/').filter(Boolean))
}
