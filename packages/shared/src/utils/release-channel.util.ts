import { GITHUB_REPO_URL } from '../constants/github.constants'
import { RELEASE_CHANNEL_MANIFEST_URL } from '../constants/release-channel.constants'
import { normalizeAppVersionNumber } from './version.utils'

export interface ReleaseChannelPlatformEntry {
  version: string
  tag: string
  artifact: string
  downloadUrl: string
  versionCode?: number
}

export interface ReleaseChannelManifest {
  android?: ReleaseChannelPlatformEntry
  windows?: ReleaseChannelPlatformEntry
  updatedAt?: string
}

function parseVersionParts(raw: string): number[] {
  return normalizeAppVersionNumber(raw)
    .split('.')
    .map((part) => {
      const n = parseInt(part.replace(/[^0-9].*$/, ''), 10)
      return Number.isFinite(n) ? n : 0
    })
}

/** 比较 semver 数字段：latest 是否比 current 新 */
export function isAppVersionNewer(latest: string, current: string): boolean {
  const a = parseVersionParts(latest)
  const b = parseVersionParts(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

function isPlatformEntry(value: unknown): value is ReleaseChannelPlatformEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.version === 'string' &&
    typeof entry.tag === 'string' &&
    typeof entry.downloadUrl === 'string'
  )
}

export function parseReleaseChannelManifest(raw: unknown): ReleaseChannelManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid release channel manifest')
  }
  const data = raw as Record<string, unknown>
  const manifest: ReleaseChannelManifest = {}
  if (data.updatedAt != null) {
    manifest.updatedAt = String(data.updatedAt)
  }
  if (isPlatformEntry(data.android)) {
    manifest.android = {
      ...data.android,
      artifact: data.android.artifact || 'BaiShou-Android.apk'
    }
  }
  if (isPlatformEntry(data.windows)) {
    manifest.windows = {
      ...data.windows,
      artifact: data.windows.artifact || 'BaiShou-Windows-Setup.exe'
    }
  }
  return manifest
}

export function releaseTagToPageUrl(tag: string, repoUrl: string = GITHUB_REPO_URL): string {
  return `${repoUrl}/releases/tag/${encodeURIComponent(tag)}`
}

export async function fetchReleaseChannelManifest(
  url: string = RELEASE_CHANNEL_MANIFEST_URL,
  fetchFn: typeof fetch = fetch
): Promise<ReleaseChannelManifest> {
  const response = await fetchFn(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Release channel HTTP ${response.status}`)
  }
  const json: unknown = await response.json()
  return parseReleaseChannelManifest(json)
}
