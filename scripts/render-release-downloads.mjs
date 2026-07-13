#!/usr/bin/env node
/**
 * 生成 Release 说明中的「各平台最新下载」Markdown 表格。
 * 各端「当前版本」来自 version.json；下载链接优先 channel.json（产物实际所在 Release），
 * 否则挂到两端 version 的 max（与 CI 挂载策略一致）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  OFFICIAL_WEBSITE_URL,
  RELEASE_ARTIFACTS,
  hostVersionFromReleaseTag,
  maxSemver,
  releaseDownloadUrl
} from './release-constants.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readVersion(app) {
  const path = join(root, 'apps', app, 'src/version.json')
  return JSON.parse(readFileSync(path, 'utf8')).version
}

function readChannel() {
  const path = join(root, 'releases/channel.json')
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function resolveHostVersion(channelEntry, appVersion, fallbackHost) {
  if (channelEntry?.version === appVersion && channelEntry.tag) {
    const host = hostVersionFromReleaseTag(channelEntry.tag)
    if (host) return host
  }
  return fallbackHost
}

export function renderReleaseDownloadsMarkdown({
  repo = 'foxletters-hq/BaiShou-Next',
  mobileVersion = readVersion('mobile'),
  desktopVersion = readVersion('desktop'),
  websiteUrl = OFFICIAL_WEBSITE_URL,
  channel = readChannel(),
  /** CI 本轮产物挂载的展示版本（两端 max）；不传则用两端 version.json 推算 */
  displayVersion = maxSemver(mobileVersion, desktopVersion)
} = {}) {
  const androidHost = resolveHostVersion(channel?.android, mobileVersion, displayVersion)
  const windowsHost = resolveHostVersion(channel?.windows, desktopVersion, displayVersion)
  const androidUrl =
    channel?.android?.version === mobileVersion && channel.android.downloadUrl
      ? channel.android.downloadUrl
      : releaseDownloadUrl(repo, androidHost, RELEASE_ARTIFACTS.android)
  const windowsUrl =
    channel?.windows?.version === desktopVersion && channel.windows.downloadUrl
      ? channel.windows.downloadUrl
      : releaseDownloadUrl(repo, windowsHost, RELEASE_ARTIFACTS.windows)

  return [
    '## 各平台最新下载',
    '',
    '| 平台 | 当前版本 | 下载 |',
    '|------|----------|------|',
    `| Android | ${mobileVersion} | [下载 APK](${androidUrl}) |`,
    `| Windows | ${desktopVersion} | [下载安装包](${windowsUrl}) |`,
    '',
    `**[官网下载（推荐）](${websiteUrl})** — 自动匹配各端最新版本。`,
    ''
  ].join('\n')
}

function main() {
  const repoIdx = process.argv.indexOf('--repo')
  const repo = repoIdx >= 0 ? process.argv[repoIdx + 1] : 'foxletters-hq/BaiShou-Next'
  console.log(renderReleaseDownloadsMarkdown({ repo }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
