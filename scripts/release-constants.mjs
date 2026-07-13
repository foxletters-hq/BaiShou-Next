/** 发版脚本与 CI 共用的常量 */
export const OFFICIAL_WEBSITE_URL = 'https://baishou.foxletters.com'

export const RELEASE_ARTIFACTS = {
  android: 'BaiShou-Android.apk',
  windows: 'BaiShou-Windows-Setup.exe'
}

export const RELEASE_ARTIFACTS_VERSIONED = {
  android: (version) => `BaiShou-v${version}-Android.apk`,
  windows: (version) => `BaiShou-v${version}-Windows-Setup.exe`
}

/** 比较 semver（仅数字段，如 1.2.12）；a>b → 正数 */
export function compareSemver(a, b) {
  const pa = String(a)
    .split('.')
    .map((x) => Number.parseInt(x, 10) || 0)
  const pb = String(b)
    .split('.')
    .map((x) => Number.parseInt(x, 10) || 0)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

/** 取两端版本中较大者（GitHub Release 展示 / 挂载 tag 用） */
export function maxSemver(...versions) {
  const list = versions.map((v) => String(v || '').trim()).filter(Boolean)
  if (list.length === 0) return ''
  return list.reduce((best, cur) => (compareSemver(cur, best) > 0 ? cur : best))
}

/** GitHub Release 统一 tag：v{semver}（semver 为两端 max） */
export function releaseTagForVersion(version) {
  return `v${version}`
}

/** 从 channel / 历史字段解析宿主 Release 版本号（v1.2.12 或 mobile/v1.2.8） */
export function hostVersionFromReleaseTag(tag) {
  if (!tag) return ''
  const s = String(tag)
  if (s.includes('/v')) return s.split('/v').pop() || ''
  return s.replace(/^v/, '')
}

export function releaseDownloadUrl(repo, version, artifact) {
  return `https://github.com/${repo}/releases/download/${releaseTagForVersion(version)}/${artifact}`
}
