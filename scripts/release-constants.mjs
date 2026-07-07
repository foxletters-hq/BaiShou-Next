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

/** GitHub Release 统一 tag：v{semver} */
export function releaseTagForVersion(version) {
  return `v${version}`
}

export function releaseDownloadUrl(repo, version, artifact) {
  return `https://github.com/${repo}/releases/download/${releaseTagForVersion(version)}/${artifact}`
}
